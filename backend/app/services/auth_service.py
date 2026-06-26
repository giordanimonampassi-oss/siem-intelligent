"""Service d'authentification, gestion des rôles et audit."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.user import CTSUser
from models.audit_log import AuditLog
from schemas.user_schemas import UserCreate, UserUpdate
from core.security import (
    hash_password, verify_password,
    generate_totp_secret, get_totp_uri, verify_totp,
    create_access_token,
)
from core.constants import UserRole


# ─── Création d'utilisateur ──────────────────────────────────────────────────

async def create_user(payload: UserCreate, db: AsyncSession) -> CTSUser:
    perimeter = ",".join(payload.perimeter) if payload.perimeter else "NETWORK,AUTH"
    user = CTSUser(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        team_scope=payload.team_scope,
        perimeter=perimeter,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession,
) -> Optional[CTSUser]:
    result = await db.execute(select(CTSUser).where(CTSUser.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        return None
    if payload.username  is not None: user.username   = payload.username
    if payload.role      is not None: user.role       = payload.role.value
    if payload.team_scope is not None: user.team_scope = payload.team_scope
    if payload.is_active is not None: user.is_active  = payload.is_active
    if payload.perimeter is not None: user.perimeter  = ",".join(payload.perimeter)
    await db.commit()
    await db.refresh(user)
    return user


# ─── Authentification ─────────────────────────────────────────────────────────

async def authenticate(email: str, password: str, db: AsyncSession) -> Optional[CTSUser]:
    result = await db.execute(select(CTSUser).where(CTSUser.email == email))
    user   = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


async def update_last_login(user: CTSUser, db: AsyncSession) -> None:
    user.last_login = datetime.now(timezone.utc)
    await db.commit()


# ─── MFA ─────────────────────────────────────────────────────────────────────

async def setup_mfa(user: CTSUser, db: AsyncSession) -> dict:
    secret = generate_totp_secret()
    user.totp_secret = secret
    await db.commit()
    return {"totp_uri": get_totp_uri(secret, user.email), "secret": secret}


async def confirm_mfa(user: CTSUser, code: str, db: AsyncSession) -> bool:
    if not user.totp_secret:
        return False
    if verify_totp(user.totp_secret, code):
        user.mfa_enabled = True
        await db.commit()
        return True
    return False


async def verify_mfa_code(user: CTSUser, code: str) -> bool:
    if not user.totp_secret:
        return False
    return verify_totp(user.totp_secret, code)


# ─── JWT ─────────────────────────────────────────────────────────────────────

def build_token(user: CTSUser, mfa_verified: bool = True) -> str:
    return create_access_token({
        "sub":          str(user.id),
        "role":         user.role,
        "team_scope":   user.team_scope or "",
        "mfa_verified": mfa_verified,
    })


# ─── Audit ───────────────────────────────────────────────────────────────────

async def log_audit(
    action: str,
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    target: Optional[str] = None,
    ip: Optional[str] = None,
    result: str = "success",
    detail: Optional[str] = None,
) -> None:
    audit = AuditLog(
        user_id=user_id,
        action=action,
        target_entity=target,
        ip_address=ip,
        result=result,
        detail=detail,
    )
    db.add(audit)
    # Pas de commit ici — le caller commit au moment opportun


# ─── Gestion des mots de passe ───────────────────────────────────────────────

async def change_password(
    user: CTSUser, old_password: str, new_password: str, db: AsyncSession
) -> bool:
    if not verify_password(old_password, user.password_hash):
        return False
    user.password_hash = hash_password(new_password)
    await db.commit()
    return True