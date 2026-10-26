import os
import sys
import datetime
import asyncio
import re
import json
import hmac
import hashlib
import logging
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("kixinvert")
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

sys.stdout.reconfigure(encoding='utf-8')

from db import get_db, engine, Base
from models import User, Portfolio, Position, Asset, MarketQuote, AuditLog, Transaction, PaymentOrder, Notification, CashMovement
from services.rates_service import fetch_current_rates
from services.bvc_service import fetch_bvc_market_data
from services.portfolio_service import get_portfolio_summary
from services.ai_service import generate_local_ai_diagnosis, answer_bvc_ai_question
from services.payment_service import create_binance_pay_order, activate_user_pro, BINANCE_PAY_SECRET_KEY
import services.notification_service as notification_service
import services.whatif_service as whatif_service
import services.telegram_service as telegram_service
import security

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# ==========================================================
# CONFIGURATION & COOKIE SECURITY
# ==========================================================

COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = "lax"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ==========================================================
# RATE LIMITING & SECURITY HEADERS MIDDLEWARE
# ==========================================================

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. DoS Protection: Maximum payload size limit (2MB)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 2 * 1024 * 1024:
            return JSONResponse(
                status_code=413,
                content={"detail": "Carga útil excesiva. El límite máximo permitido es de 2MB."}
            )

        # 2. Information Disclosure Prevention: Block access to dotfiles or sensitive extensions
        path = request.url.path.lower()
        if "/." in path or path.endswith((".env", ".git", ".py", ".db", ".sqlite", ".sqlite3", ".log", ".key", ".pem", ".bak")):
            return JSONResponse(
                status_code=403,
                content={"detail": "Acceso denegado a recurso restringido o protegido."}
            )

        response = await call_next(request)

        # 3. High-Grade Financial Security Headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Server"] = "KixInvertAPP-Secure"

        # Content Security Policy (Allows local Next.js frontend, Google Fonts, and in-memory charts)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' https: http: data:; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' https: data:; "
            "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 http://localhost:3000 http://127.0.0.1:3000 https://www.bolsadecaracas.com; "
            "frame-ancestors 'none';"
        )

        # 4. Anti-caching for all API responses with financial/portfolio data
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

app = FastAPI(
    title="KixInvertAPP - Terminal Bursátil Tri-Monetario BVC",
    description="Sistema Financiero Bursátil con Seguridad Bancaria y Doble Factor",
    version="2.1.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)

# Allowed CORS origins
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000")
allowed_origins_list = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    from db import SessionLocal
    asyncio.create_task(telegram_service.telegram_polling_worker(SessionLocal))

# Mount static files directory securely
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ==========================================================
# AUDIT LOG HELPER
# ==========================================================

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
    if not payload or "sub" not in payload:
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

# ==========================================================
# STRICT REQUEST / RESPONSE SCHEMAS (DATA SANITIZATION)
# ==========================================================

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

class TwoFactorVerifyLogin(BaseModel):
    user_uuid: str = Field(..., min_length=36, max_length=36, pattern=r"^[a-fA-F0-9-]{36}$")
    totp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class TwoFactorEnableRequest(BaseModel):
    secret: str = Field(..., min_length=16, max_length=64, pattern=r"^[A-Z2-7=]+$")
    totp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class TwoFactorDisableRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    totp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class PositionCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    shares: float = Field(..., gt=0, le=100_000_000)
    buy_price: float = Field(..., gt=0, le=100_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    deduct_from_cash: Optional[bool] = Field(True, description="Liquidar automáticamente del saldo disponible en efectivo")
    broker_commission: Optional[float] = Field(0.0, ge=0)
    broker_iva: Optional[float] = Field(0.0, ge=0)
    broker_registry_fee: Optional[float] = Field(0.0, ge=0)
    net_total_amount: Optional[float] = Field(None, ge=0)
    execution_date: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=200)

class PositionUpdate(BaseModel):
    shares: float = Field(..., gt=0, le=100_000_000)
    buy_price: float = Field(..., gt=0, le=100_000_000_000)
    adjust_cash: Optional[bool] = Field(False, description="Ajustar la diferencia del costo en el saldo en efectivo disponible")
    notes: Optional[str] = Field(None, max_length=200)

class PositionSell(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    shares_to_sell: float = Field(..., gt=0, le=100_000_000)
    sell_price: float = Field(..., gt=0, le=100_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    credit_to_cash: Optional[bool] = Field(True, description="Acreditar automáticamente al saldo de efectivo disponible")
    broker_commission: Optional[float] = Field(0.0, ge=0)
    broker_iva: Optional[float] = Field(0.0, ge=0)
    broker_registry_fee: Optional[float] = Field(0.0, ge=0)
    net_total_amount: Optional[float] = Field(None, ge=0)
    execution_date: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=200)

class CashDepositRequest(BaseModel):
    amount: float = Field(..., gt=0, le=1_000_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    date: Optional[str] = Field(None, max_length=30)
    concept: Optional[str] = Field("Aporte de capital para inversión", max_length=150)
    reference: Optional[str] = Field(None, max_length=100)

class CashUpdate(BaseModel):
    cash_ves: float = Field(..., ge=0, le=1_000_000_000_000)
    cash_usd: float = Field(..., ge=0, le=1_000_000_000)

class AIChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    demo_count: Optional[int] = Field(0, ge=0, le=100)

class WhatIfSimulateRequest(BaseModel):
    bcv_target: float = Field(..., gt=0, le=100_000_000)
    usdt_target: float = Field(..., gt=0, le=100_000_000)
    wall_street_shock_pct: Optional[float] = Field(0.0, ge=-50.0, le=100.0)
    bvc_adjustment_rate: Optional[float] = Field(0.85, ge=0.0, le=1.5)

# ==========================================================
# PUBLIC & STATIC ENDPOINTS
# ==========================================================

@app.get("/")
def serve_index():
    response = FileResponse(os.path.join(STATIC_DIR, "index.html"))
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/api/rates")
async def get_rates(db: Session = Depends(get_db)):
    rates = await fetch_current_rates(db)
    return rates

@app.post("/api/rates/sync")
@limiter.limit("20/minute")
async def sync_all_market_data(request: Request, db: Session = Depends(get_db)):
    rates = await fetch_current_rates(db, force_refresh=True)
    quotes = await fetch_bvc_market_data(db, rates["bcv"], rates["usdt"], force_refresh=True)
    return {
        "success": True,
        "rates": rates,
        "quotes_count": len(quotes),
        "message": "Datos de mercado y tasas sincronizados correctamente"
    }

@app.get("/api/quotes")
async def get_quotes(force: bool = False, db: Session = Depends(get_db)):
    rates = await fetch_current_rates(db, force_refresh=force)
    quotes = await fetch_bvc_market_data(db, rates["bcv"], rates["usdt"], force_refresh=force)
    return {
        "rates": rates,
        "quotes": quotes
    }

# ==========================================================
# AUTHENTICATION & IAM (WITH 2FA, HONEYPOT & ENCRYPTED CREDENTIALS)
# ==========================================================

@app.post("/api/auth/register")
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

    token = security.create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "uuid": user.uuid,
        "role": user.role
    })

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="kix_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=86400,
        path="/"
    )

    return {
        "success": True,
        "message": "¡Cuenta creada exitosamente!",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "uuid": user.uuid,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "broker": user.broker,
            "risk_profile": user.risk_profile,
            "portfolio_id": portfolio.id,
            "two_factor_enabled": False,
            "subscription_tier": user.subscription_tier or "free",
            "is_pro": False,
            "ai_queries_used_this_month": 0,
            "ai_queries_limit": 10
        }
    }

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

@app.post("/api/auth/login")
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

    # 4. CHECK IF 2FA IS ENABLED
    if user.two_factor_enabled:
        log_audit(db, "2FA_REQUIRED", user_id=user.id, request=request, details="2FA step requested")
        return {
            "success": True,
            "two_factor_required": True,
            "user_uuid": user.uuid,
            "message": "Ingresa el código de 6 dígitos de Google Authenticator para continuar."
        }

    # 5. NO 2FA -> ISSUE JWT ACCESS TOKEN & SECURE COOKIE
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()
    if not portfolio:
        portfolio = Portfolio(
            user_id=user.id,
            name=f"Portafolio BVC de {user.full_name}",
            cash_ves=10000.0,
            cash_usd=20.0
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

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

    log_audit(db, "LOGIN_SUCCESS", user_id=user.id, request=request, details="Successful login without 2FA")

    is_pro = check_and_refresh_user_subscription(user, db)

    return {
        "success": True,
        "two_factor_required": False,
        "message": f"¡Bienvenido de vuelta, {user.full_name}!",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "uuid": user.uuid,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "broker": user.broker,
            "risk_profile": user.risk_profile,
            "portfolio_id": portfolio.id,
            "two_factor_enabled": False,
            "subscription_tier": user.subscription_tier or "free",
            "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "is_pro": is_pro,
            "ai_queries_used_this_month": user.ai_queries_used_this_month or 0,
            "ai_queries_limit": None if is_pro else 10
        }
    }

@app.post("/api/auth/2fa/verify-login")
@limiter.limit("10/minute")
async def verify_2fa_login(request: Request, response: Response, item: TwoFactorVerifyLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uuid == item.user_uuid).first()
    if not user or not user.two_factor_enabled or not user.two_factor_secret:
        raise HTTPException(status_code=400, detail="Solicitud de 2FA no válida.")

    # Decrypt TOTP secret from database
    decrypted_secret = security.decrypt_sensitive_data(user.two_factor_secret)

    if not security.verify_totp_code(decrypted_secret, item.totp_code):
        log_audit(db, "2FA_LOGIN_FAILED", user_id=user.id, request=request, details="Invalid 2FA code")
        raise HTTPException(status_code=401, detail="Código 2FA incorrecto o expirado. Verifica la hora de tu dispositivo.")

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()

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

    log_audit(db, "2FA_LOGIN_SUCCESS", user_id=user.id, request=request, details="Successful login with 2FA TOTP")

    is_pro = check_and_refresh_user_subscription(user, db)

    return {
        "success": True,
        "message": f"¡Autenticación en dos pasos exitosa! Bienvenido, {user.full_name}",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "uuid": user.uuid,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "broker": user.broker,
            "risk_profile": user.risk_profile,
            "portfolio_id": portfolio.id if portfolio else None,
            "two_factor_enabled": True,
            "subscription_tier": user.subscription_tier or "free",
            "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "is_pro": is_pro,
            "ai_queries_used_this_month": user.ai_queries_used_this_month or 0,
            "ai_queries_limit": None if is_pro else 10
        }
    }

@app.post("/api/auth/2fa/setup")
@limiter.limit("10/minute")
async def setup_2fa(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = security.generate_totp_secret()
    uri = security.get_totp_provisioning_uri(secret, current_user.email)
    qr_b64 = security.generate_qr_code_base64(uri)

    return {
        "secret": secret,
        "qr_code_base64": qr_b64,
        "manual_entry_key": " ".join([secret[i:i+4] for i in range(0, len(secret), 4)])
    }

@app.post("/api/auth/2fa/enable")
@limiter.limit("10/minute")
async def enable_2fa(item: TwoFactorEnableRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not security.verify_totp_code(item.secret, item.totp_code):
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto. Asegúrate de escanear el código y escribir los 6 dígitos actuales.")

    # Encrypt 2FA secret at rest before persisting to PostgreSQL
    current_user.two_factor_secret = security.encrypt_sensitive_data(item.secret)
    current_user.two_factor_enabled = True
    db.commit()

    log_audit(db, "2FA_ENABLED", user_id=current_user.id, request=request, details="2FA TOTP activated with field encryption")

    return {
        "success": True,
        "message": "¡Verificación en Dos Pasos (2FA) activada con éxito en tu cuenta!"
    }

@app.post("/api/auth/2fa/disable")
@limiter.limit("10/minute")
async def disable_2fa(item: TwoFactorDisableRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    is_valid, _ = security.verify_and_maybe_upgrade_password(item.password, current_user.password_hash)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

    decrypted_secret = security.decrypt_sensitive_data(current_user.two_factor_secret)
    if not security.verify_totp_code(decrypted_secret, item.totp_code):
        raise HTTPException(status_code=400, detail="Código 2FA incorrecto.")

    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    db.commit()

    log_audit(db, "2FA_DISABLED", user_id=current_user.id, request=request, details="2FA TOTP deactivated")

    return {
        "success": True,
        "message": "Autenticación de Dos Pasos desactivada correctamente."
    }

@app.post("/api/auth/logout")
async def logout_user(response: Response, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    if current_user:
        log_audit(db, "LOGOUT", user_id=current_user.id, details="User logged out")
    response.delete_cookie(key="kix_token", path="/", httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    return {"success": True, "message": "Sesión cerrada correctamente."}

@app.get("/api/auth/me")
async def get_current_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    is_pro = check_and_refresh_user_subscription(current_user, db)
    return {
        "id": current_user.id,
        "uuid": current_user.uuid,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "broker": current_user.broker,
        "risk_profile": current_user.risk_profile,
        "role": current_user.role,
        "two_factor_enabled": current_user.two_factor_enabled,
        "portfolio_id": portfolio.id if portfolio else None,
        "subscription_tier": current_user.subscription_tier or "free",
        "subscription_expires_at": current_user.subscription_expires_at.isoformat() if current_user.subscription_expires_at else None,
        "is_pro": is_pro,
        "ai_queries_used_this_month": current_user.ai_queries_used_this_month or 0,
        "ai_queries_limit": None if is_pro else 10
    }

@app.get("/api/audit-logs")
async def get_user_audit_logs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # STRICT ROW LEVEL SECURITY: Only returns current user's audit entries
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id
    ).order_by(AuditLog.created_at.desc()).limit(25).all()

    return [
        {
            "id": log.id,
            "action": log.action,
            "ip_address": log.ip_address,
            "details": log.details,
            "created_at": log.created_at.strftime("%d/%m/%Y %H:%M:%S") if log.created_at else ""
        }
        for log in logs
    ]

# ==========================================================
# SECURE PORTFOLIO & TRADING (BLINDADO CONTRA IDOR)
# ==========================================================

@app.get("/api/portfolio")
async def get_portfolio(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    rates = await fetch_current_rates(db)

    # Phase 3: Sync international stocks quotes for active holdings
    try:
        from services.international_service import sync_all_portfolio_international_quotes
        sync_all_portfolio_international_quotes(db, rates["bcv"])
    except Exception as e:
        logger.error(f"Error syncing international quotes: {e}")

    # ANTI-IDOR: strictly isolated by current_user.id
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
        if not portfolio:
            portfolio = Portfolio(
                user_id=current_user.id,
                name=f"Portafolio BVC de {current_user.full_name}",
                cash_ves=0.0,
                cash_usd=0.0
            )
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
        summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], portfolio_id=portfolio.id, user_id=current_user.id)
    else:
        # Unauthenticated guest: return dedicated read-only demo portfolio
        demo_port = db.query(Portfolio).filter(Portfolio.id == 999).first()
        demo_id = demo_port.id if demo_port else None
        summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], portfolio_id=demo_id)

    summary["rates"] = rates
    return summary

@app.post("/api/positions")
@limiter.limit("30/minute")
async def add_position(
    item: PositionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Sanitize ticker symbol
    ticker = security.sanitize_ticker(item.ticker)
    if not ticker:
        raise HTTPException(status_code=400, detail="Símbolo de acción inválido.")

    rates = await fetch_current_rates(db)
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    # Phase 3: Detect if international Wall Street asset
    from services.international_service import (
        is_international_ticker,
        get_asset_metadata,
        sync_international_market_quote
    )
    is_intl = is_international_ticker(ticker) or item.currency.upper() == "USD"
    meta = get_asset_metadata(ticker) if is_intl else None

    # ANTI-IDOR: strictly target current user's portfolio
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        portfolio = Portfolio(
            user_id=current_user.id,
            name=f"Portafolio BVC de {current_user.full_name}",
            cash_ves=0.0,
            cash_usd=0.0
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    buy_price_ves = item.buy_price * bcv if item.currency.upper() == "USD" else item.buy_price

    # Ensure asset exists in catalogue
    asset = db.query(Asset).filter(Asset.ticker == ticker).first()
    if not asset:
        asset = Asset(
            ticker=ticker,
            name=meta["name"] if meta else ticker,
            market=meta["market"] if meta else "BVC",
            currency="USD" if is_intl else "VES",
            sector=meta["sector"] if meta else "Acción BVC"
        )
        db.add(asset)
        db.commit()
    elif is_intl and asset.market == "BVC":
        asset.market = meta["market"] if meta else "US"
        asset.currency = "USD"
        if meta and meta.get("name"):
            asset.name = meta["name"]
        db.commit()

    # Pre-sync market quote for international asset so current price is immediately accurate
    if is_intl:
        try:
            sync_international_market_quote(db, ticker, bcv)
        except Exception as e:
            logger.warning(f"Could not pre-sync international quote for {ticker}: {e}")

    # Parse execution date if provided
    exec_date = datetime.datetime.utcnow()
    if item.execution_date:
        try:
            exec_date = datetime.datetime.fromisoformat(item.execution_date.replace("Z", "+00:00"))
        except Exception:
            try:
                exec_date = datetime.datetime.strptime(item.execution_date, "%Y-%m-%d")
            except Exception:
                pass

    # Reject purchases the available cash can't cover (before touching the position)
    if item.deduct_from_cash:
        pre_fees_ves = float(item.broker_commission or 0.0) + float(item.broker_iva or 0.0) + float(item.broker_registry_fee or 0.0)
        if is_intl or item.currency.upper() == "USD":
            pre_cost = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (item.shares * item.buy_price + (pre_fees_ves / bcv if bcv > 0 else 0.0))
            available, label = float(portfolio.cash_usd or 0.0), "${:,.2f}"
        else:
            pre_cost = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (item.shares * buy_price_ves + pre_fees_ves)
            available, label = float(portfolio.cash_ves or 0.0), "Bs {:,.2f}"
        if pre_cost > available + 0.005:
            raise HTTPException(
                status_code=400,
                detail=f"Efectivo insuficiente: la compra cuesta {label.format(pre_cost)} y tu saldo disponible es {label.format(available)}. "
                       "Ajusta tu saldo o desmarca 'Liquidar del efectivo'."
            )

    # Atomicity: add or average down existing position
    existing_pos = db.query(Position).filter(
        Position.portfolio_id == portfolio.id,
        Position.ticker == ticker
    ).first()

    if existing_pos:
        total_shares = float(existing_pos.shares) + item.shares
        avg_price = (
            (float(existing_pos.shares) * float(existing_pos.avg_buy_price_ves)) +
            (item.shares * buy_price_ves)
        ) / total_shares
        existing_pos.shares = total_shares
        existing_pos.avg_buy_price_ves = avg_price
    else:
        new_pos = Position(
            portfolio_id=portfolio.id,
            ticker=ticker,
            shares=item.shares,
            avg_buy_price_ves=buy_price_ves,
            historic_rate_bcv=bcv,
            historic_rate_usdt=usdt,
            created_at=exec_date
        )
        db.add(new_pos)

    # Automatic Cash Liquidation & Cash Ledger Recording
    fees_ves = float(item.broker_commission or 0.0) + float(item.broker_iva or 0.0) + float(item.broker_registry_fee or 0.0)
    if is_intl or item.currency.upper() == "USD":
        fees_currency = fees_ves / bcv if bcv > 0 else 0.0
    else:
        fees_currency = fees_ves

    if item.deduct_from_cash:
        if is_intl or item.currency.upper() == "USD":
            gross_usd = item.shares * item.buy_price
            cost_usd = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (gross_usd + fees_currency)
            new_cash_usd = max(0.0, float(portfolio.cash_usd) - cost_usd)
            portfolio.cash_usd = new_cash_usd
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="BUY_STOCK",
                currency="USD",
                amount=cost_usd,
                balance_after=new_cash_usd,
                concept=f"Liquidación compra {item.shares:,.0f} acc {ticker} (Comisiones: ${fees_currency:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)
        else:
            gross_ves = item.shares * buy_price_ves
            cost_ves = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (gross_ves + fees_ves)
            new_cash_ves = max(0.0, float(portfolio.cash_ves) - cost_ves)
            portfolio.cash_ves = new_cash_ves
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="BUY_STOCK",
                currency="VES",
                amount=cost_ves,
                balance_after=new_cash_ves,
                concept=f"Liquidación compra {item.shares:,.0f} acc {ticker} (Comisiones/IVA: Bs {fees_ves:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)

    # Record trade in transactions ledger
    tx = Transaction(
        portfolio_id=portfolio.id,
        ticker=ticker,
        tx_type="BUY",
        shares=item.shares,
        price_ves=buy_price_ves,
        fee_ves=fees_ves,
        rate_bcv=bcv,
        rate_usdt=usdt,
        notes=item.notes or f"Compra de {item.shares:,.0f} acc {ticker} (Gastos operacionales: Bs {fees_ves:,.2f})",
        executed_at=exec_date
    )
    db.add(tx)

    db.commit()

    log_audit(
        db,
        "BUY_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Added {item.shares} shares of {ticker} @ {buy_price_ves:.2f} VES (Fees: {fees_ves:.2f} VES)"
    )

    return {
        "success": True,
        "message": f"Posición {ticker} registrada con éxito. Saldo en efectivo liquidado: Bs {float(portfolio.cash_ves):,.2f}",
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd)
    }

@app.put("/api/positions/{position_id}")
@limiter.limit("30/minute")
def update_position(
    position_id: int,
    item: PositionUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # STRICT ANTI-IDOR: verify ownership
    pos = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not pos:
        raise HTTPException(
            status_code=404,
            detail="Posición no encontrada o no pertenece a tu portafolio."
        )

    portfolio = pos.portfolio
    old_shares = float(pos.shares)
    old_price = float(pos.avg_buy_price_ves)
    old_total_cost = old_shares * old_price

    new_shares = float(item.shares)
    new_price = float(item.buy_price)
    new_total_cost = new_shares * new_price

    # Optional cash balance adjustment (e.g., if user added 150 shares too many and wants cash refunded)
    if item.adjust_cash and portfolio:
        diff = old_total_cost - new_total_cost
        available = float(portfolio.cash_ves or 0.0)
        if diff < 0 and -diff > available + 0.005:
            raise HTTPException(
                status_code=400,
                detail=f"Efectivo insuficiente: el ajuste cuesta Bs {-diff:,.2f} y tu saldo disponible es Bs {available:,.2f}."
            )
        if abs(diff) > 0.0001:
            new_cash = available + diff
            portfolio.cash_ves = new_cash
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="DEPOSIT" if diff > 0 else "BUY_STOCK",
                currency="VES",
                amount=abs(diff),
                balance_after=new_cash,
                concept=f"Ajuste por edición de {pos.ticker} ({old_shares:,.0f} -> {new_shares:,.0f} acc)",
                movement_date=datetime.datetime.utcnow()
            )
            db.add(cm)

    pos.shares = new_shares
    pos.avg_buy_price_ves = new_price
    db.commit()

    log_audit(
        db,
        "UPDATE_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Updated {pos.ticker}: {old_shares} -> {new_shares} shares, price {old_price:.2f} -> {new_price:.2f} VES"
    )

    return {
        "success": True,
        "message": f"Posición en {pos.ticker} actualizada correctamente ({new_shares:,.0f} acciones a Bs {new_price:,.2f})",
        "cash_ves": float(portfolio.cash_ves) if portfolio else 0.0,
        "cash_usd": float(portfolio.cash_usd) if portfolio else 0.0
    }

@app.post("/api/positions/sell")
@limiter.limit("30/minute")
async def sell_position(
    item: PositionSell,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticker = security.sanitize_ticker(item.ticker)
    if not ticker:
        raise HTTPException(status_code=400, detail="Símbolo de acción inválido.")

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado.")

    pos = db.query(Position).filter(
        Position.portfolio_id == portfolio.id,
        Position.ticker == ticker
    ).first()

    if not pos:
        raise HTTPException(status_code=404, detail=f"No posees acciones de {ticker} en tu portafolio.")

    current_shares = float(pos.shares)
    if item.shares_to_sell > current_shares + 0.0001:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes vender {item.shares_to_sell:,.0f} acciones. Tu saldo disponible es de {current_shares:,.0f} acciones."
        )

    rates = await fetch_current_rates(db)
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    is_usd = item.currency.upper() == "USD"
    sell_price_ves = item.sell_price * bcv if is_usd else item.sell_price
    gross_ves = item.shares_to_sell * sell_price_ves

    # Mercosur / Broker commissions breakdown
    comm_ves = float(item.broker_commission or 0.0) * (bcv if is_usd else 1.0)
    iva_ves = float(item.broker_iva or 0.0) * (bcv if is_usd else 1.0)
    fees_other_ves = float(item.broker_registry_fee or 0.0) * (bcv if is_usd else 1.0)
    total_fees_ves = comm_ves + iva_ves + fees_other_ves

    if item.net_total_amount is not None and item.net_total_amount > 0:
        net_ves = float(item.net_total_amount) * (bcv if is_usd else 1.0)
    else:
        net_ves = max(0.0, gross_ves - total_fees_ves)

    # Realized PnL vs average purchase price
    cost_basis_unit = float(pos.avg_buy_price_ves)
    cost_basis_sold = item.shares_to_sell * cost_basis_unit
    realized_pnl_ves = net_ves - cost_basis_sold

    # Update or close position
    remaining_shares = max(0.0, current_shares - item.shares_to_sell)
    if remaining_shares <= 0.0001:
        db.delete(pos)
    else:
        pos.shares = remaining_shares

    # Parse execution date
    exec_date = datetime.datetime.utcnow()
    if item.execution_date:
        try:
            exec_date = datetime.datetime.fromisoformat(item.execution_date.replace("Z", "+00:00"))
        except Exception:
            try:
                exec_date = datetime.datetime.strptime(item.execution_date, "%Y-%m-%d")
            except Exception:
                pass

    # Credit proceeds to cash balance if requested
    if item.credit_to_cash:
        if is_usd:
            net_usd = net_ves / bcv if bcv > 0 else 0.0
            new_cash_usd = float(portfolio.cash_usd or 0.0) + net_usd
            portfolio.cash_usd = new_cash_usd
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="SELL_STOCK",
                currency="USD",
                amount=net_usd,
                balance_after=new_cash_usd,
                concept=f"Liquidación venta {item.shares_to_sell:,.0f} acc {ticker} (Neto: ${net_usd:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)
        else:
            new_cash_ves = float(portfolio.cash_ves or 0.0) + net_ves
            portfolio.cash_ves = new_cash_ves
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="SELL_STOCK",
                currency="VES",
                amount=net_ves,
                balance_after=new_cash_ves,
                concept=f"Liquidación venta {item.shares_to_sell:,.0f} acc {ticker} (Neto: Bs {net_ves:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)

    # Record trade in transactions table
    tx = Transaction(
        portfolio_id=portfolio.id,
        ticker=ticker,
        tx_type="SELL",
        shares=item.shares_to_sell,
        price_ves=sell_price_ves,
        fee_ves=total_fees_ves,
        rate_bcv=bcv,
        rate_usdt=usdt,
        notes=item.notes or f"Venta de {item.shares_to_sell:,.0f} acc {ticker} (Neto: Bs {net_ves:,.2f}, PnL: Bs {realized_pnl_ves:,.2f})",
        executed_at=exec_date
    )
    db.add(tx)
    db.commit()

    log_audit(
        db,
        "SELL_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Sold {item.shares_to_sell} shares of {ticker} @ {sell_price_ves:.2f} VES (Net: {net_ves:.2f} VES, PnL: {realized_pnl_ves:.2f} VES)"
    )

    return {
        "success": True,
        "message": f"Venta de {item.shares_to_sell:,.0f} {ticker} ejecutada con éxito. Monto neto acreditado: Bs {net_ves:,.2f}",
        "remaining_shares": remaining_shares,
        "gross_ves": round(gross_ves, 2),
        "total_fees_ves": round(total_fees_ves, 2),
        "net_ves": round(net_ves, 2),
        "realized_pnl_ves": round(realized_pnl_ves, 2),
        "cash_ves": float(portfolio.cash_ves or 0.0),
        "cash_usd": float(portfolio.cash_usd or 0.0)
    }

@app.get("/api/portfolio/transactions")
@limiter.limit("30/minute")
def get_portfolio_transactions(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        return []

    txs = db.query(Transaction).filter(
        Transaction.portfolio_id == portfolio.id
    ).order_by(Transaction.executed_at.desc()).limit(limit).all()

    return [
        {
            "id": t.id,
            "ticker": t.ticker,
            "tx_type": t.tx_type,
            "shares": float(t.shares),
            "price_ves": float(t.price_ves),
            "fee_ves": float(t.fee_ves or 0.0),
            "rate_bcv": float(t.rate_bcv) if t.rate_bcv else None,
            "rate_usdt": float(t.rate_usdt) if t.rate_usdt else None,
            "notes": t.notes,
            "executed_at": t.executed_at.isoformat() if t.executed_at else None
        }
        for t in txs
    ]

@app.delete("/api/positions/{position_id}")
@limiter.limit("30/minute")
def delete_position(
    position_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # STRICT ANTI-IDOR: Joins Portfolio and asserts ownership by current_user
    pos = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not pos:
        raise HTTPException(
            status_code=404,
            detail="Posición no encontrada o no pertenece a tu portafolio."
        )

    ticker = pos.ticker
    shares = float(pos.shares)
    db.delete(pos)
    db.commit()

    log_audit(
        db,
        "CLOSE_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Deleted position {ticker} ({shares} shares)"
    )

    return {"success": True, "message": f"Posición {ticker} eliminada con éxito de tu portafolio"}

@app.put("/api/portfolio/cash")
@limiter.limit("20/minute")
def update_cash(
    item: CashUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ANTI-IDOR: Always target current_user's portfolio
    port = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not port:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado.")

    port.cash_ves = item.cash_ves
    port.cash_usd = item.cash_usd
    db.commit()

    log_audit(
        db,
        "CASH_UPDATE",
        user_id=current_user.id,
        request=request,
        details=f"Updated cash balance: VES {item.cash_ves:,.2f} | USD {item.cash_usd:,.2f}"
    )

    return {"success": True, "message": "Saldos de efectivo actualizados con éxito"}

@app.post("/api/portfolio/deposit")
@limiter.limit("30/minute")
async def deposit_cash(
    item: CashDepositRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        portfolio = Portfolio(
            user_id=current_user.id,
            name=f"Portafolio BVC de {current_user.full_name}",
            cash_ves=0.0,
            cash_usd=0.0
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    dep_date = datetime.datetime.utcnow()
    if item.date:
        try:
            dep_date = datetime.datetime.fromisoformat(item.date.replace("Z", "+00:00"))
        except Exception:
            try:
                dep_date = datetime.datetime.strptime(item.date, "%Y-%m-%d")
            except Exception:
                pass

    if item.currency.upper() == "USD":
        portfolio.cash_usd = float(portfolio.cash_usd) + item.amount
        bal_after = float(portfolio.cash_usd)
    else:
        portfolio.cash_ves = float(portfolio.cash_ves) + item.amount
        bal_after = float(portfolio.cash_ves)

    cm = CashMovement(
        portfolio_id=portfolio.id,
        movement_type="DEPOSIT",
        currency=item.currency.upper(),
        amount=item.amount,
        balance_after=bal_after,
        concept=item.concept or "Depósito de liquidez para inversión",
        reference=item.reference,
        movement_date=dep_date
    )
    db.add(cm)
    db.commit()

    log_audit(
        db,
        "CASH_DEPOSIT",
        user_id=current_user.id,
        request=request,
        details=f"Deposit of {item.amount:,.2f} {item.currency.upper()}"
    )

    return {
        "success": True,
        "message": f"Depósito de {item.amount:,.2f} {item.currency.upper()} registrado con éxito.",
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd),
        "movement": {
            "id": cm.id,
            "movement_type": cm.movement_type,
            "currency": cm.currency,
            "amount": float(cm.amount),
            "balance_after": float(cm.balance_after),
            "concept": cm.concept,
            "date": cm.movement_date.isoformat()
        }
    }

@app.get("/api/portfolio/cash-movements")
def get_cash_movements(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        return {"movements": [], "cash_ves": 0.0, "cash_usd": 0.0}

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        return {"movements": [], "cash_ves": 0.0, "cash_usd": 0.0}

    movements = db.query(CashMovement).filter(
        CashMovement.portfolio_id == portfolio.id
    ).order_by(CashMovement.movement_date.desc(), CashMovement.id.desc()).limit(100).all()

    return {
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd),
        "movements": [
            {
                "id": m.id,
                "movement_type": m.movement_type,
                "currency": m.currency,
                "amount": float(m.amount),
                "balance_after": float(m.balance_after),
                "concept": m.concept,
                "reference": m.reference,
                "movement_date": m.movement_date.isoformat(),
                "created_at": m.created_at.isoformat()
            }
            for m in movements
        ]
    }

# ==========================================================
# PHASE 3: WALL STREET & INTERNATIONAL ASSETS
# ==========================================================

@app.get("/api/international/popular")
async def get_popular_international_stocks():
    """Returns curated popular Wall Street stocks and ETFs with real-time quotes."""
    from services.international_service import POPULAR_INTERNATIONAL_ASSETS, fetch_international_quote
    results = []
    for ticker, info in POPULAR_INTERNATIONAL_ASSETS.items():
        q = fetch_international_quote(ticker)
        results.append(q if q else info)
    return results

@app.get("/api/international/quote/{ticker}")
async def get_single_international_quote(ticker: str):
    """Fetches real-time quote for a specific international ticker."""
    from services.international_service import fetch_international_quote
    clean_ticker = security.sanitize_ticker(ticker)
    if not clean_ticker:
        raise HTTPException(status_code=400, detail="Ticker inválido")
    q = fetch_international_quote(clean_ticker)
    if not q:
        raise HTTPException(status_code=404, detail=f"No se pudo obtener cotización para {clean_ticker}")
    return q

@app.post("/api/ai/diagnosis")
@limiter.limit("15/minute")
async def get_ai_diagnosis(
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    rates = await fetch_current_rates(db)
    portfolio_id = None
    user_id = None
    if current_user:
        user_id = current_user.id
        port = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
        if port:
            portfolio_id = port.id
    else:
        demo_port = db.query(Portfolio).filter(Portfolio.id == 999).first()
        if demo_port:
            portfolio_id = demo_port.id

    summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], portfolio_id=portfolio_id, user_id=user_id)
    diagnosis = generate_local_ai_diagnosis(summary, rates)
    return diagnosis

@app.post("/api/ai/chat")
@limiter.limit("15/minute")
async def chat_with_bvc_ai(
    req: AIChatRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    # 1. Enforce demo practice limit (max 2 queries for unauthenticated guests)
    if not current_user:
        if (req.demo_count or 0) > 2:
            return {
                "answer": (
                    "🔒 **Has alcanzado el límite de 2 consultas de práctica gratuitas en el Modo Demo.**\n\n"
                    "Para continuar disfrutando de **consultas ilimitadas**, conectar tu portafolio personalizado en la Bolsa de Caracas, "
                    "recibir alertas de brecha cambiaria y recomendaciones tácticas exclusivas, **regístrate gratis en KixInvert**."
                ),
                "limit_reached": True,
                "subscription_tier": "demo",
                "queries_remaining": 0,
                "upgrade_required": False
            }
    else:
        # 2. Authenticated user: Check PRO status and monthly limit
        is_pro = check_and_refresh_user_subscription(current_user, db)
        if not is_pro:
            # Free tier: 10 queries limit per month
            if (current_user.ai_queries_used_this_month or 0) >= 10:
                return {
                    "answer": (
                        "🔒 **Has alcanzado tu límite mensual de 10 consultas en el Plan Gratuito.**\n\n"
                        "Para continuar realizando **consultas ilimitadas**, recibir señales de compra/venta en tiempo real "
                        "y acceder a diagnósticos avanzados de cobertura cambiaria, **activa el Plan PRO 👑 por solo $5 USDT/mes con Binance Pay**."
                    ),
                    "limit_reached": True,
                    "subscription_tier": "free",
                    "queries_used": current_user.ai_queries_used_this_month,
                    "queries_remaining": 0,
                    "queries_limit": 10,
                    "upgrade_required": True
                }

    sanitized_question = security.sanitize_text(req.question, 500)

    rates = await fetch_current_rates(db)
    portfolio_id = None
    user_id = None
    if current_user:
        user_id = current_user.id
        port = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
        if port:
            portfolio_id = port.id
    else:
        demo_port = db.query(Portfolio).filter(Portfolio.id == 999).first()
        if demo_port:
            portfolio_id = demo_port.id

    summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], portfolio_id=portfolio_id, user_id=user_id)
    answer = await answer_bvc_ai_question(sanitized_question, summary, rates)

    queries_remaining = None
    subscription_tier = "demo"
    queries_limit = 2
    queries_used = 1

    if not current_user:
        count = req.demo_count or 1
        queries_remaining = max(0, 2 - count)
        queries_used = count
        if queries_remaining == 0:
            answer += (
                "\n\n💡 *Has utilizado tus 2 consultas de práctica del Modo Demo. "
                "Regístrate gratis para continuar realizando consultas con tu propio portafolio.*"
            )
    else:
        current_user.ai_queries_used_this_month = (current_user.ai_queries_used_this_month or 0) + 1
        db.commit()
        db.refresh(current_user)
        
        is_pro = current_user.subscription_tier == "pro"
        subscription_tier = "pro" if is_pro else "free"
        queries_used = current_user.ai_queries_used_this_month
        queries_limit = None if is_pro else 10
        queries_remaining = "ilimitadas" if is_pro else max(0, 10 - current_user.ai_queries_used_this_month)

    return {
        "answer": answer,
        "limit_reached": False,
        "subscription_tier": subscription_tier,
        "queries_used": queries_used,
        "queries_remaining": queries_remaining,
        "queries_limit": queries_limit
    }

# ==========================================================
# BINANCE PAY PAYMENTS & PRO SUBSCRIPTION ENDPOINTS
# ==========================================================

class CreateOrderRequest(BaseModel):
    plan: Optional[str] = "pro_monthly"
    amount_usdt: Optional[float] = 5.00

@app.post("/api/payments/create-binance-order")
@limiter.limit("15/minute")
async def api_create_binance_order(
    item: CreateOrderRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order_data = create_binance_pay_order(
        db, 
        current_user, 
        plan=item.plan or "pro_monthly", 
        amount_usdt=item.amount_usdt or 5.00
    )
    return {
        "success": True,
        "order": order_data
    }

@app.get("/api/payments/order-status/{order_id}")
async def api_get_order_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(PaymentOrder).filter(
        PaymentOrder.order_id == order_id, 
        PaymentOrder.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de pago no encontrada.")
    
    is_pro = check_and_refresh_user_subscription(current_user, db)
    return {
        "order_id": order.order_id,
        "status": order.status,
        "amount_usdt": float(order.amount_usdt),
        "is_pro": is_pro,
        "expires_at": current_user.subscription_expires_at.isoformat() if current_user.subscription_expires_at else None
    }

@app.post("/api/payments/simulate-binance-success/{order_id}")
async def api_simulate_binance_success(
    order_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(PaymentOrder).filter(
        PaymentOrder.order_id == order_id, 
        PaymentOrder.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    
    result = activate_user_pro(db, current_user, order)
    return result

@app.post("/api/payments/binance-webhook")
async def api_binance_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        body_bytes = await request.body()
        body_str = body_bytes.decode('utf-8')
        payload = json.loads(body_str) if body_str else {}
        
        if BINANCE_PAY_SECRET_KEY:
            timestamp = request.headers.get("BinancePay-Timestamp", "")
            nonce = request.headers.get("BinancePay-Nonce", "")
            signature = request.headers.get("BinancePay-Signature", "")
            expected_sig = hmac.new(
                BINANCE_PAY_SECRET_KEY.encode("utf-8"),
                f"{timestamp}\n{nonce}\n{body_str}\n".encode("utf-8"),
                hashlib.sha512
            ).hexdigest().upper()
            if signature != expected_sig:
                raise HTTPException(status_code=400, detail="Firma inválida")

        biz_status = payload.get("bizStatus")
        data = payload.get("data", {})
        merchant_trade_no = data.get("merchantTradeNo")

        if biz_status == "PAY_SUCCESS" and merchant_trade_no:
            order = db.query(PaymentOrder).filter(PaymentOrder.order_id == merchant_trade_no).first()
            if order and order.status != "PAID":
                user = db.query(User).filter(User.id == order.user_id).first()
                if user:
                    activate_user_pro(db, user, order)

        return {"returnCode": "SUCCESS", "returnMessage": None}
    except Exception as e:
        return {"returnCode": "FAIL", "returnMessage": str(e)}

# ==========================================================
# NOTIFICATIONS & ALERTS API
# ==========================================================

@app.get("/api/notifications")
async def api_get_notifications(
    category: Optional[str] = Query(None, description="Category filter: tactical, market, or all"),
    limit: int = Query(30, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    notifications = notification_service.get_user_notifications(db, user_id=user_id, category=category, limit=limit)
    unread_count = notification_service.get_unread_count(db, user_id=user_id)
    return {
        "unread_count": unread_count,
        "notifications": notifications
    }

@app.post("/api/notifications/{notification_id}/read")
async def api_mark_notification_read(
    notification_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    success = notification_service.mark_notification_read(db, notification_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    unread_count = notification_service.get_unread_count(db, user_id=user_id)
    return {"status": "ok", "unread_count": unread_count}

@app.post("/api/notifications/read-all")
async def api_mark_all_notifications_read(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    count = notification_service.mark_all_notifications_read(db, user_id=user_id)
    return {"status": "ok", "marked_read": count, "unread_count": 0}

@app.post("/api/notifications/refresh")
async def api_refresh_notifications(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    generated = notification_service.generate_smart_notifications(db, user_id=user_id)
    notifications = notification_service.get_user_notifications(db, user_id=user_id, limit=30)
    unread_count = notification_service.get_unread_count(db, user_id=user_id)
    return {
        "status": "ok",
        "generated_count": len(generated),
        "unread_count": unread_count,
        "notifications": notifications
    }

# ==========================================================
# WHAT-IF STRESS SIMULATOR & EXECUTIVE REPORT API
# ==========================================================

@app.post("/api/portfolio/simulate-what-if")
async def api_simulate_what_if(
    payload: WhatIfSimulateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    # ANTI-IDOR: guests only ever see the read-only demo portfolio (same as /api/portfolio)
    if user_id:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    else:
        portfolio = db.query(Portfolio).filter(Portfolio.id == 999).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="No hay portafolio disponible para simular.")

    rates = await fetch_current_rates(db)
    bcv = float(rates.get("bcv", 881.87))
    usdt = float(rates.get("usdt", 1007.60))
    summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id)

    result = whatif_service.simulate_financial_stress_scenario(
        portfolio_summary=summary,
        bcv_target=payload.bcv_target,
        usdt_target=payload.usdt_target,
        wall_street_shock_pct=payload.wall_street_shock_pct or 0.0,
        bvc_adjustment_rate=payload.bvc_adjustment_rate if payload.bvc_adjustment_rate is not None else 0.85
    )
    return result

@app.get("/api/portfolio/executive-report")
async def api_get_executive_report(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    report_data = whatif_service.generate_executive_report_data(db, user_id=user_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="No se pudo compilar el reporte ejecutivo.")
    return report_data

# ==========================================================
# TELEGRAM BOT INTEGRATION API (@KixInvertAlertsBot)
# ==========================================================

class TelegramLinkRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, max_length=50)
    telegram_username: Optional[str] = None

class TelegramToggleAlertsRequest(BaseModel):
    enabled: Optional[bool] = None

@app.get("/api/telegram/status")
async def api_get_telegram_status(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    is_linked = bool(user.telegram_chat_id)
    masked_chat_id = ""
    if user.telegram_chat_id:
        cid = str(user.telegram_chat_id)
        masked_chat_id = cid[:3] + "***" + cid[-3:] if len(cid) > 6 else cid

    return {
        "linked": is_linked,
        "chat_id": masked_chat_id,
        "raw_chat_id": user.telegram_chat_id if is_linked else None,
        "telegram_username": user.telegram_username,
        "alerts_enabled": bool(user.telegram_alerts_enabled),
        "link_code": user.telegram_link_code,
        "bot_username": telegram_service.TELEGRAM_BOT_USERNAME,
        "bot_configured": telegram_service.is_telegram_configured()
    }

@app.post("/api/telegram/generate-code")
async def api_generate_telegram_code(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    code = telegram_service.generate_pairing_code(db, user)
    return {
        "status": "ok",
        "link_code": code,
        "bot_username": telegram_service.TELEGRAM_BOT_USERNAME,
        "instruction": f"Envía /start {code} a @{telegram_service.TELEGRAM_BOT_USERNAME} en Telegram."
    }

@app.get("/api/telegram/pairing-url")
def get_telegram_pairing_url(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if not user.telegram_link_code:
        user.telegram_link_code = telegram_service.generate_pairing_code(db, user)

    bot_username = telegram_service.TELEGRAM_BOT_USERNAME
    direct_url = f"https://t.me/{bot_username}?start={user.telegram_link_code}"

    return {
        "bot_username": bot_username,
        "link_code": user.telegram_link_code,
        "direct_url": direct_url,
        "linked": bool(user.telegram_chat_id),
        "telegram_username": user.telegram_username,
        "chat_id": user.telegram_chat_id
    }

@app.post("/api/telegram/link")
async def api_link_telegram(
    payload: TelegramLinkRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    telegram_service.link_user_by_chat_id(
        db=db,
        user=user,
        chat_id=payload.chat_id,
        telegram_username=payload.telegram_username
    )
    return {
        "status": "ok",
        "message": "Cuenta vinculada exitosamente con Telegram.",
        "chat_id": payload.chat_id,
        "alerts_enabled": True
    }

@app.post("/api/telegram/unlink")
async def api_unlink_telegram(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    telegram_service.unlink_user_telegram(db, user)
    return {
        "status": "ok",
        "message": "Cuenta de Telegram desvinculada exitosamente."
    }

@app.post("/api/telegram/toggle-alerts")
async def api_toggle_telegram_alerts(
    payload: Optional[TelegramToggleAlertsRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    enabled = payload.enabled if payload else None
    new_state = telegram_service.toggle_user_telegram_alerts(db, user, enabled)
    return {
        "status": "ok",
        "alerts_enabled": new_state
    }

@app.post("/api/telegram/test-alert")
async def api_test_telegram_alert(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user = current_user if current_user else db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if not user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Debes vincular tu cuenta de Telegram antes de enviar una alerta de prueba.")

    test_text = (
        "🧪 <b>ALERTA DE PRUEBA EXITOSA | KixInvertAPP</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Hola <b>{user.full_name}</b> (@{user.username}).\n\n"
        "Esta es una alerta de prueba para confirmar que tu canal móvil en Telegram está 100% operativo y conectado a tu cartera de la Bolsa de Valores de Caracas.\n\n"
        "⚡ <i>Recibirás avisos instantáneos de brecha y señales de compra/venta en este chat.</i>"
    )
    result = telegram_service.send_telegram_message(user.telegram_chat_id, test_text)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Error al enviar mensaje a Telegram."))
    return {
        "status": "ok",
        "result": result,
        "message": "Alerta de prueba enviada satisfactoriamente a tu Telegram."
    }

@app.post("/api/telegram/webhook")
async def api_telegram_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    result = telegram_service.handle_incoming_telegram_message(db, payload)
    return {"status": "ok", "result": result}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

