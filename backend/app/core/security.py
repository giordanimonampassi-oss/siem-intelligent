"""
Sécurité — Smart SIEM
Gestion des mots de passe (bcrypt), JWT et MFA TOTP (RFC 6238).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import pyotp
from jose import JWTError, jwt
# from passlib.context import CryptContext
import bcrypt

from core.config import settings

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# pwd_context = CryptContext(
#     schemes=["bcrypt"],
#     deprecated="auto",
#     bcrypt__rounds=12,
#     bcrypt__ident="2b",
# )


# def hash_password(plain: str) -> str:
#     return pwd_context.hash(plain)


# def verify_password(plain: str, hashed: str) -> bool:
#     return pwd_context.verify(plain, hashed)

def hash_password(plain: str) -> str:
    # 1. On transforme le mot de passe en clair en bytes
    password_bytes = plain.encode('utf-8')
    # 2. On génère un sel de 12 rounds
    salt = bcrypt.gensalt(rounds=12)
    # 3. On hache et on redécode en chaîne de caractères (string) pour la base de données
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        # On encode les deux chaînes en bytes pour que bcrypt puisse les comparer
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=settings.mfa_issuer)


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=120)