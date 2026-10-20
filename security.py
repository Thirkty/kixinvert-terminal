import os
import re
import io
import base64
import datetime
import hashlib
import html
import secrets
from typing import Optional, Tuple, List
import bcrypt
import jwt
import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken

# ==========================================================
# CRYPTOGRAPHIC KEYS & SECRETS CONFIGURATION
# ==========================================================

# 1. JWT Secret Key (strictly from environment or dynamic fallback)
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    # If not set, generate a cryptographic ephemeral secret for runtime safety
    SECRET_KEY = secrets.token_hex(32)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# 2. Symmetric Field Encryption Key (Fernet - AES-128-CBC + HMAC-SHA256)
RAW_ENC_KEY = os.getenv("APP_ENCRYPTION_KEY")
if RAW_ENC_KEY:
    try:
        cipher_suite = Fernet(RAW_ENC_KEY.encode("utf-8"))
    except Exception:
        # Normalize to valid 32-byte urlsafe base64 key
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(RAW_ENC_KEY.encode("utf-8")).digest())
        cipher_suite = Fernet(derived_key)
else:
    # Derive from SECRET_KEY deterministically
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode("utf-8")).digest())
    cipher_suite = Fernet(derived_key)

# ==========================================================
# FIELD-LEVEL ENCRYPTION (FOR SENSITIVE DATA AT REST)
# ==========================================================

def encrypt_sensitive_data(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypts sensitive data (e.g. 2FA secrets, private tokens)
    before writing to the database using authenticated symmetric encryption.
    """
    if not plaintext:
        return plaintext
    try:
        encrypted = cipher_suite.encrypt(plaintext.encode("utf-8"))
        return encrypted.decode("utf-8")
    except Exception as e:
        print(f"Encryption error: {e}")
        return plaintext

def decrypt_sensitive_data(ciphertext: Optional[str]) -> Optional[str]:
    """
    Decrypts sensitive data upon retrieval from the database.
    If the data is legacy unencrypted, safely returns plaintext.
    """
    if not ciphertext:
        return ciphertext
    try:
        decrypted = cipher_suite.decrypt(ciphertext.encode("utf-8"))
        return decrypted.decode("utf-8")
    except (InvalidToken, Exception):
        # Fallback for unencrypted legacy rows
        return ciphertext

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
    if len(password) < 10:
        errors.append("La contraseña debe tener al menos 10 caracteres.")
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
# 2FA (TOTP - GOOGLE AUTHENTICATOR / AUTHY)
# ==========================================================

def generate_totp_secret() -> str:
    """Generates a secure random base32 seed for Google Authenticator."""
    return pyotp.random_base32()

def get_totp_provisioning_uri(secret: str, username: str) -> str:
    """Generates the otpauth:// URI recognized by Google Authenticator and Authy."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name="KixInvertAPP BVC")

def generate_qr_code_base64(provisioning_uri: str) -> str:
    """
    Generates a high-contrast QR code completely in-memory (no external services)
    and returns a base64 Data URI string ready to be rendered in an <img> tag.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buffered = io.BytesIO()
    img.save(buffered)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verifies a 6-digit TOTP code against the user's secret.
    Allows valid_window=1 (30s clock drift tolerance) for real-world devices.
    """
    if not secret or not code:
        return False
    # Clean non-digits
    clean_code = re.sub(r"\D", "", str(code))
    if len(clean_code) != 6:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(clean_code, valid_window=1)
    except Exception:
        return False
