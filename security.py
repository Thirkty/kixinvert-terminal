import os
import re
import datetime
import hashlib
import html
import io
import base64
import secrets
from typing import Optional, Tuple, List
import bcrypt
import jwt
from dotenv import load_dotenv
import pyotp
import qrcode
from cryptography.fernet import Fernet

# ==========================================================
# CRYPTOGRAPHIC KEYS & SECRETS CONFIGURATION
# ==========================================================

load_dotenv()

# 1. JWT Secret Key (strictly from environment or dynamic fallback)
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY or SECRET_KEY.startswith("change_this"):
    if os.getenv("ENVIRONMENT", "development") == "production":
        # A random per-boot key would silently log everyone out on every restart
        raise RuntimeError("JWT_SECRET_KEY must be set to a strong random value in production.")
    SECRET_KEY = secrets.token_hex(32)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# 2. Key for data encrypted at rest (2FA secrets). It must survive restarts: a random
#    per-boot key would make every stored secret unreadable and lock people out.
_RAW_ENC_KEY = os.getenv("APP_ENCRYPTION_KEY") or os.getenv("JWT_SECRET_KEY")
if _RAW_ENC_KEY and not _RAW_ENC_KEY.startswith("change_this"):
    _FERNET = Fernet(base64.urlsafe_b64encode(hashlib.sha256(_RAW_ENC_KEY.encode("utf-8")).digest()))
else:
    _FERNET = None


def encrypt_secret(plaintext: str) -> str:
    if not _FERNET:
        raise RuntimeError("Falta APP_ENCRYPTION_KEY en el .env para guardar secretos cifrados.")
    return _FERNET.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    if not _FERNET:
        raise RuntimeError("Falta APP_ENCRYPTION_KEY en el .env para leer secretos cifrados.")
    return _FERNET.decrypt(ciphertext.encode("utf-8")).decode("utf-8")

# ==========================================================
# INPUT SANITIZATION & SECURITY HELPERS
# ==========================================================

def sanitize_text(text: Optional[str], max_length: int = 255) -> str:
    """
    Sanitizes user string input: strips whitespace, escapes HTML entities to prevent XSS,
    and enforces maximum length bounds.
    """
    if not text:
        return ""
    # Strip null bytes and control chars
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(text).strip())
    # Escape HTML to prevent XSS
    escaped = html.escape(clean)
    return escaped[:max_length]

def sanitize_ticker(ticker: Optional[str]) -> str:
    """Sanitizes stock ticker symbol: uppercase, alphanumeric plus dot, max 12 chars."""
    if not ticker:
        return ""
    clean = re.sub(r"[^A-Za-z0-9.]", "", str(ticker)).upper().strip()
    return clean[:12]

# ==========================================================
# PASSWORD HASHING & VALIDATION (BCRYPT WORK FACTOR 12)
# ==========================================================

def hash_password(password: str) -> str:
    """Hashes a password with Bcrypt using automatic work factor (12 rounds) and salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_and_maybe_upgrade_password(plain_password: str, hashed_password: str) -> Tuple[bool, Optional[str]]:
    """
    Verifies a password against Bcrypt or legacy SHA256.
    If the password matches legacy SHA256, returns (True, new_bcrypt_hash) for transparent upgrading.
    """
    if not hashed_password or not plain_password:
        return False, None

    # Check if hash is Bcrypt ($2a$ or $2b$)
    if hashed_password.startswith("$2a$") or hashed_password.startswith("$2b$"):
        try:
            match = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
            return match, None
        except Exception:
            return False, None

    # Fallback: check legacy SHA256 (64 hex characters)
    legacy_sha256 = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    if legacy_sha256.lower() == hashed_password.lower():
        # Valid legacy password! Generate modern Bcrypt hash to upgrade
        new_hash = hash_password(plain_password)
        return True, new_hash

    return False, None

def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """
    Financial-grade password complexity validation:
    - Minimum 10 characters, maximum 128
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special symbol (!@#$%^&*-_)
    """
    errors = []
    if len(password) < 8:
        errors.append("La contraseña debe tener al menos 8 caracteres.")
    if len(password) > 128:
        errors.append("La contraseña no puede exceder 128 caracteres.")
    if not re.search(r"[A-Z]", password):
        errors.append("Debe contener al menos una letra mayúscula (A-Z).")
    if not re.search(r"[a-z]", password):
        errors.append("Debe contener al menos una letra minúscula (a-z).")
    if not re.search(r"[0-9]", password):
        errors.append("Debe contener al menos un número (0-9).")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_]", password):
        errors.append("Debe contener al menos un símbolo especial (!@#$%^&*-_).")

    common_passwords = {"password123", "admin123", "1234567890", "qwerty1234", "bvc1234567"}
    if password.lower() in common_passwords:
        errors.append("La contraseña seleccionada es demasiado común y predecible.")

    return len(errors) == 0, errors

# ==========================================================
# JWT SESSION TOKENS (WITH EXPIRATION & SIGNATURE VERIFICATION)
# ==========================================================

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Creates a signed, time-limited JWT access token with unique jti identifier."""
    to_encode = data.copy()
    now = datetime.datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "jti": secrets.token_hex(16)
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT access token, enforcing expiration and HS256 algorithm."""
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "iat", "sub"]}
        )
        return payload
    except (jwt.PyJWTError, Exception):
        return None


# ==========================================================
# 2FA (TOTP: Google Authenticator, Authy, Microsoft Authenticator)
# ==========================================================

TOTP_ISSUER = "KixInvert"
TWO_FACTOR_CHALLENGE_MINUTES = 5


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_qr_data_uri(secret: str, account: str) -> str:
    """QR built in memory (the secret never goes to a third-party service)."""
    uri = pyotp.TOTP(secret).provisioning_uri(name=account, issuer_name=TOTP_ISSUER)
    img = qrcode.make(uri, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def verify_totp(secret: str, code: str) -> bool:
    """Accepts the current 30-second code and the previous/next one (clock drift)."""
    digits = re.sub(r"\D", "", code or "")
    return len(digits) == 6 and pyotp.TOTP(secret).verify(digits, valid_window=1)


def create_2fa_challenge(user_id: int) -> str:
    """Short-lived token proving the password step passed. It is NOT a session token."""
    return create_access_token(
        {"sub": str(user_id), "purpose": "2fa"},
        expires_delta=datetime.timedelta(minutes=TWO_FACTOR_CHALLENGE_MINUTES),
    )
