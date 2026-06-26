"""Dépendances FastAPI — session DB, utilisateur courant, RBAC."""
import uuid
from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from elasticsearch import AsyncElasticsearch

from core.security import decode_access_token
from core.constants import UserRole
from db.database import AsyncSessionLocal, es_client
from models.user import CTSUser

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_es() -> AsyncElasticsearch:
    return es_client


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CTSUser:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload:
        raise exc

    # Vérifier MFA si l'utilisateur a le MFA activé
    # (le champ mfa_verified est dans le payload JWT)
    user_id = payload.get("sub")
    if not user_id:
        raise exc

    result = await db.execute(select(CTSUser).where(CTSUser.id == uuid.UUID(user_id)))
    user   = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise exc

    # Bloquer si MFA activé mais pas vérifié dans ce token
    if user.mfa_enabled and not payload.get("mfa_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA requis — veuillez compléter la vérification TOTP",
        )
    return user


def require_role(*roles: UserRole):
    """Factory RBAC — vérifie que l'utilisateur a l'un des rôles requis."""
    async def check(current_user: CTSUser = Depends(get_current_user)) -> CTSUser:
        if current_user.role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle(s) requis : {[r.value for r in roles]}",
            )
        return current_user
    return check


# Raccourcis par rôle
require_reader  = require_role(UserRole.READER, UserRole.ANALYST, UserRole.RSSI,
                               UserRole.AUDITOR, UserRole.ADMIN)
require_analyst = require_role(UserRole.ANALYST, UserRole.ADMIN)
require_rssi    = require_role(UserRole.RSSI, UserRole.ADMIN)
require_auditor = require_role(UserRole.AUDITOR, UserRole.ADMIN)
require_admin   = require_role(UserRole.ADMIN)