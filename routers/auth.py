"""Registro, inicio y cierre de sesión."""
import asyncio
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db import get_db
from models import User, Portfolio, Position, Asset
from services.rates_service import fetch_current_rates
import security
from deps import (
    limiter, COOKIE_SECURE, COOKIE_SAMESITE, log_audit, get_current_user,
    get_optional_current_user, check_and_refresh_user_subscription, get_or_create_portfolio,
)

router = APIRouter()


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: str = Field(..., min_length=5, max_length=100, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: Optional[str] = Field(None, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    system_website_hp: Optional[str] = Field(None, max_length=100) # Honeypot
    broker: Optional[str] = Field("KixBroker BVC", max_length=50)
    risk_profile: Optional[str] = Field("Moderado", max_length=30)
    initial_cash_ves: Optional[float] = Field(0.0, ge=0, le=1_000_000_000_000)
    initial_cash_usd: Optional[float] = Field(0.0, ge=0, le=1_000_000_000)
    include_sample_positions: Optional[bool] = False

class UserLogin(BaseModel):
    username_or_email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)
    system_website_hp: Optional[str] = Field(None, max_length=100) # Honeypot


def _start_session(response: Response, user: User) -> str:
    """Firma el token de sesión y lo deja también en una cookie HttpOnly."""
    token = security.create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "uuid": user.uuid,
        "role": user.role
    })
    response.set_cookie(
        key="kix_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=86400,
        path="/"
    )
    return token


def _user_payload(user: User, portfolio: Optional[Portfolio], is_pro: bool) -> dict:
    return {
        "id": user.id,
        "uuid": user.uuid,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "broker": user.broker,
        "risk_profile": user.risk_profile,
        "role": user.role,
        "portfolio_id": portfolio.id if portfolio else None,
        "subscription_tier": user.subscription_tier or "free",
        "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
        "is_pro": is_pro,
        "ai_queries_used_this_month": user.ai_queries_used_this_month or 0,
        "ai_queries_limit": None if is_pro else 10
    }


@router.post("/api/auth/register")
@limiter.limit("5/minute")
async def register_user(request: Request, response: Response, item: UserRegister, db: Session = Depends(get_db)):
    # 1. HONEYPOT BOT DEFENSE: If hidden field is filled, reject immediately
    if item.system_website_hp and len(item.system_website_hp.strip()) > 0:
        await asyncio.sleep(1.0)
        log_audit(db, "BOT_BLOCKED", request=request, details="Honeypot triggered during registration")
        raise HTTPException(status_code=400, detail="Petición no permitida.")

    # 2. SANITIZE INPUTS
    username = security.sanitize_text(item.username, 30).lower()
    email = security.sanitize_text(item.email, 100).lower()
    full_name = security.sanitize_text(item.full_name, 100)
    broker = security.sanitize_text(item.broker or "KixBroker BVC", 50)
    risk_profile = security.sanitize_text(item.risk_profile or "Moderado", 30)

    # 3. PASSWORD STRENGTH VALIDATION
    is_strong, errors = security.validate_password_strength(item.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail="Requisitos de contraseña: " + " ".join(errors))

    # Check username existence
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail=f"El usuario '{username}' ya está registrado. Por favor elige otro o inicia sesión.")

    # Check email existence
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado.")

    # Create new User with Bcrypt hash (12 work rounds)
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        password_hash=security.hash_password(item.password),
        broker=broker,
        risk_profile=risk_profile,
        role="investor",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create dedicated user Portfolio
    portfolio = Portfolio(
        user_id=user.id,
        name=f"Portafolio BVC de {user.full_name}",
        cash_ves=item.initial_cash_ves if item.initial_cash_ves is not None else 0.0,
        cash_usd=item.initial_cash_usd if item.initial_cash_usd is not None else 0.0
    )
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)

    # Optional: seed sample positions
    if item.include_sample_positions:
        rates = await fetch_current_rates(db)
        bcv = rates.get("bcv", 880.0)
        usdt = rates.get("usdt", 1000.0)
        samples = [
            ("BNC", 250.0, 18.50),
            ("RST.B", 100.0, 540.00),
            ("TDV.D", 80.0, 1150.00),
            ("BVCC", 50.0, 820.00)
        ]
        for tck, sh, pr in samples:
            asset = db.query(Asset).filter(Asset.ticker == tck).first()
            if not asset:
                asset = Asset(ticker=tck, name=tck, market="BVC", currency="VES")
                db.add(asset)
                db.commit()
            pos = Position(
                portfolio_id=portfolio.id,
                ticker=tck,
                shares=sh,
                avg_buy_price_ves=pr,
                historic_rate_bcv=bcv,
                historic_rate_usdt=usdt
            )
            db.add(pos)
        db.commit()

    log_audit(db, "REGISTER", user_id=user.id, request=request, details=f"New investor registered: {user.username}")

    token = _start_session(response, user)

    return {
        "success": True,
        "message": "¡Cuenta creada exitosamente!",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": _user_payload(user, portfolio, is_pro=False)
    }


@router.post("/api/auth/login")
@limiter.limit("5/minute")
async def login_user(request: Request, response: Response, item: UserLogin, db: Session = Depends(get_db)):
    # 1. HONEYPOT BOT CHECK
    if item.system_website_hp and len(item.system_website_hp.strip()) > 0:
        await asyncio.sleep(1.0)
        log_audit(db, "BOT_BLOCKED", request=request, details="Honeypot triggered during login")
        raise HTTPException(status_code=400, detail="Petición no permitida.")

    identifier = security.sanitize_text(item.username_or_email, 100).lower()

    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    GENERIC_AUTH_ERROR = "Credenciales incorrectas. Verifica tu usuario/correo y contraseña."

    if not user:
        raise HTTPException(status_code=401, detail=GENERIC_AUTH_ERROR)

    # 2. CHECK LOCKOUT STATUS
    if user.locked_until and user.locked_until > datetime.datetime.utcnow():
        remaining = int((user.locked_until - datetime.datetime.utcnow()).total_seconds() / 60) + 1
        log_audit(db, "LOGIN_WHILE_LOCKED", user_id=user.id, request=request, details="Attempted login on locked account")
        raise HTTPException(
            status_code=403,
            detail=f"Cuenta temporalmente bloqueada por exceso de intentos fallidos. Intenta de nuevo en {remaining} minutos o contacta a soporte."
        )

    # 3. VERIFY PASSWORD & AUTO-UPGRADE TO BCRYPT
    is_valid, upgraded_hash = security.verify_and_maybe_upgrade_password(item.password, user.password_hash)

    if not is_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
            log_audit(db, "ACCOUNT_LOCKED", user_id=user.id, request=request, details="Account locked for 15 minutes after 5 failed attempts")
        else:
            log_audit(db, "FAILED_LOGIN", user_id=user.id, request=request, details=f"Failed attempt {user.failed_login_attempts}")
        db.commit()
        raise HTTPException(status_code=401, detail=GENERIC_AUTH_ERROR)

    if upgraded_hash:
        user.password_hash = upgraded_hash

    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    # 4. ISSUE JWT ACCESS TOKEN & SECURE COOKIE
    portfolio = get_or_create_portfolio(db, user)
    token = _start_session(response, user)

    log_audit(db, "LOGIN_SUCCESS", user_id=user.id, request=request, details="Successful login")

    is_pro = check_and_refresh_user_subscription(user, db)

    return {
        "success": True,
        "message": f"¡Bienvenido de vuelta, {user.full_name}!",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": _user_payload(user, portfolio, is_pro)
    }


@router.post("/api/auth/logout")
async def logout_user(response: Response, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    if current_user:
        log_audit(db, "LOGOUT", user_id=current_user.id, details="User logged out")
    response.delete_cookie(key="kix_token", path="/", httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    return {"success": True, "message": "Sesión cerrada correctamente."}

@router.get("/api/auth/me")
async def get_current_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    is_pro = check_and_refresh_user_subscription(current_user, db)
    return _user_payload(current_user, portfolio, is_pro)
