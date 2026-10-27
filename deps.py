"""Piezas compartidas por los routers: límite de peticiones, sesión, auditoría y plan del usuario."""
import os
import datetime
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from db import get_db
from models import User, AuditLog, Portfolio
import security

COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = "lax"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

def log_audit(db: Session, action: str, user_id: Optional[int] = None, request: Optional[Request] = None, details: Optional[str] = None):
    try:
        ip = request.client.host if request and request.client else None
        ua = request.headers.get("user-agent", "")[:250] if request else None
        entry = AuditLog(
            user_id=user_id,
            action=security.sanitize_text(action, 50),
            ip_address=security.sanitize_text(ip, 50),
            user_agent=security.sanitize_text(ua, 250),
            details=security.sanitize_text(details, 500),
            created_at=datetime.datetime.utcnow()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Notice: Audit logging error: {e}")

# ==========================================================
# AUTHENTICATION DEPENDENCIES (ROW LEVEL SECURITY & ANTI-IDOR)
# ==========================================================

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif "kix_token" in request.cookies:
        token = request.cookies.get("kix_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no iniciada o token ausente. Por favor inicia sesión.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = security.decode_access_token(token)
    # Tokens with a "purpose" (e.g. the 2FA challenge) are not sessions
    if not payload or "sub" not in payload or payload.get("purpose"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión ha expirado o el token es inválido. Por favor inicia sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario no válido.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o suspendido.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user

def get_optional_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None


def check_and_refresh_user_subscription(user: User, db: Session) -> bool:
    now = datetime.datetime.utcnow()
    updated = False
    
    # 1. Reset monthly quota if 30 days have passed
    if user.ai_queries_reset_at:
        if (now - user.ai_queries_reset_at).days >= 30:
            user.ai_queries_used_this_month = 0
            user.ai_queries_reset_at = now
            updated = True
    else:
        user.ai_queries_reset_at = now
        updated = True

    # 2. Check if PRO subscription expired
    if user.subscription_tier == "pro" and user.subscription_expires_at:
        if user.subscription_expires_at < now:
            user.subscription_tier = "free"
            updated = True

    if updated:
        db.commit()
        db.refresh(user)

    is_pro = user.subscription_tier == "pro" and (user.subscription_expires_at is None or user.subscription_expires_at > now)
    return is_pro


def get_or_create_portfolio(db: Session, user: User) -> Portfolio:
    """Portafolio del usuario; si todavía no tiene uno, lo crea vacío."""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()
    if not portfolio:
        portfolio = Portfolio(user_id=user.id, name=f"Portafolio BVC de {user.full_name}", cash_ves=0.0, cash_usd=0.0)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    return portfolio


def parse_client_date(value: Optional[str]) -> datetime.datetime:
    """Fecha que manda la web (ISO o AAAA-MM-DD); si falta o no se entiende, ahora."""
    if value:
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                return datetime.datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                pass
    return datetime.datetime.utcnow()
