"""Service UEBA — Module 4 (Analyse comportementale)."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from models.user import CTSUser
from models.ueba import UserBehaviorProfile, UEBAAnomaly


async def list_profiles(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CTSUser, UserBehaviorProfile)
        .join(UserBehaviorProfile, UserBehaviorProfile.user_id == CTSUser.id, isouter=True)
    )
    return [_to_profile_dict(user, profile) for user, profile in result.all()]


async def get_profile(entity_id: str, db: AsyncSession) -> Optional[Dict[str, Any]]:
    result = await db.execute(
        select(CTSUser, UserBehaviorProfile)
        .join(UserBehaviorProfile, UserBehaviorProfile.user_id == CTSUser.id, isouter=True)
        .where(CTSUser.username == entity_id)
    )
    row = result.first()
    if not row:
        return None
    user, profile = row
    return _to_profile_dict(user, profile)


def _to_profile_dict(user: CTSUser, profile: Optional[UserBehaviorProfile]) -> Dict[str, Any]:
    avg_volume_bytes = (profile.avg_daily_volume_mb * 1024 * 1024) if profile and profile.avg_daily_volume_mb else 0.0
    typical_hours = {}
    if profile and profile.avg_login_hour is not None:
        typical_hours = {str(int(round(profile.avg_login_hour))).zfill(2): 100}
    return {
        "entity_id":       user.username,
        "entity_type":     "user",
        "risk_score":      user.risk_score or 0.0,
        "avg_data_volume": avg_volume_bytes,
        "typical_hours":   typical_hours,
    }


async def _get_profile_orm(entity_id: str, db: AsyncSession) -> Optional[UserBehaviorProfile]:
    user_result = await db.execute(select(CTSUser).where(CTSUser.username == entity_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return None
    profile_result = await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.user_id == user.id)
    )
    return profile_result.scalar_one_or_none()


async def get_anomalies(entity_id: str, db: AsyncSession) -> List[UEBAAnomaly]:
    profile = await _get_profile_orm(entity_id, db)
    if not profile:
        return []
    result = await db.execute(
        select(UEBAAnomaly)
        .where(UEBAAnomaly.profile_id == profile.id)
        .order_by(desc(UEBAAnomaly.detected_at))
    )
    return result.scalars().all()


async def record_anomaly(
    db: AsyncSession, profile_id: uuid.UUID,
    anomaly_type: str, description: str, score_delta: float,
) -> UEBAAnomaly:
    """Enregistre une anomalie et met a jour le risk_score de l'utilisateur."""
    anomaly = UEBAAnomaly(
        profile_id=profile_id, anomaly_type=anomaly_type,
        description=description, score_delta=score_delta,
    )
    db.add(anomaly)

    profile_result = await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.id == profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile:
        user_result = await db.execute(select(CTSUser).where(CTSUser.id == profile.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.risk_score = min(100.0, (user.risk_score or 0.0) + score_delta)
            user.last_risk_update = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(anomaly)
    return anomaly


async def get_score_history(entity_id: str, days: int, db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Historique approximatif reconstruit par cumul des anomalies horodatees.
    TODO : remplacer par un snapshot quotidien du risk_score si un suivi
    precis est necessaire (table dediee UEBAScoreSnapshot).
    """
    anomalies = sorted(await get_anomalies(entity_id, db), key=lambda a: a.detected_at)
    history, running = [], 0.0
    for a in anomalies:
        running = min(100.0, running + a.score_delta)
        history.append({"date": a.detected_at, "score": running})
    return history