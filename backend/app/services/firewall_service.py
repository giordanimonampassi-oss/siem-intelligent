"""
Service de blocage IP — perimetre applicatif (verifie a chaque requete via
middleware). C'est le blocage 'reel' au sens ou l'attaquant est effectivement
rejete par l'API, sans toucher au pare-feu du systeme d'exploitation.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.blocked_ip import BlockedIP


async def block_ip(
    db: AsyncSession, ip_address: str,
    reason: str = "", duration_minutes: Optional[int] = 60,
) -> BlockedIP:
    existing = (await db.execute(
        select(BlockedIP).where(BlockedIP.ip_address == ip_address)
    )).scalar_one_or_none()

    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        if duration_minutes else None
    )

    if existing:
        existing.is_active    = True
        existing.reason       = reason or existing.reason
        existing.blocked_at   = datetime.now(timezone.utc)
        existing.expires_at   = expires_at
        existing.unblocked_at = None
        entry = existing
    else:
        entry = BlockedIP(ip_address=ip_address, reason=reason, expires_at=expires_at)
        db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return entry


async def unblock_ip(db: AsyncSession, ip_address: str) -> Optional[BlockedIP]:
    entry = (await db.execute(
        select(BlockedIP).where(BlockedIP.ip_address == ip_address)
    )).scalar_one_or_none()
    if not entry:
        return None
    entry.is_active    = False
    entry.unblocked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return entry


async def is_blocked(db: AsyncSession, ip_address: str) -> bool:
    entry = (await db.execute(
        select(BlockedIP).where(BlockedIP.ip_address == ip_address, BlockedIP.is_active == True)
    )).scalar_one_or_none()
    if not entry:
        return False
    if entry.expires_at and entry.expires_at <= datetime.now(timezone.utc):
        entry.is_active    = False
        entry.unblocked_at = datetime.now(timezone.utc)
        await db.commit()
        return False
    return True


async def list_blocked(db: AsyncSession, active_only: bool = True) -> List[BlockedIP]:
    q = select(BlockedIP)
    if active_only:
        q = q.where(BlockedIP.is_active == True)
    return (await db.execute(q.order_by(BlockedIP.blocked_at.desc()))).scalars().all()