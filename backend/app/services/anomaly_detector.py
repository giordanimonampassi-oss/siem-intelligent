"""
Detection d'anomalies comportementales — compare chaque log a la baseline
de son entite (utilisateur via username, machine via host) et enregistre
une UEBAAnomaly + met a jour le risk_score en cas d'ecart significatif.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from models.log_entry import LogEntry
from models.ueba import UserBehaviorProfile, UEBAAnomaly
from services import ueba_service
from core.constants import EntityType

HOUR_DEVIATION_THRESHOLD = 5      # heures d'ecart vs avg_login_hour
VOLUME_RATIO_THRESHOLD   = 5.0    # x fois la moyenne = anomalie volume
TIME_ANOMALY_SCORE       = 15.0
VOLUME_ANOMALY_SCORE     = 30.0
RESOURCE_ANOMALY_SCORE   = 25.0

# Checkpoint en memoire — suffisant pour un projet etudiant (un seul process).
# En prod, stocker ca en base pour survivre a un redemarrage.
_last_checkpoint: Optional[datetime] = None


async def _get_profile_for_log(log: LogEntry, db: AsyncSession) -> Optional[UserBehaviorProfile]:
    """Retrouve le profil utilisateur (par username) ou machine (par host) du log."""
    if log.username:
        result = await db.execute(
            select(UserBehaviorProfile).where(
                and_(UserBehaviorProfile.entity_type == EntityType.USER.value,
                     UserBehaviorProfile.entity_label == log.username)
            )
        )
        profile = result.scalar_one_or_none()
        if profile:
            return profile
    if log.host:
        result = await db.execute(
            select(UserBehaviorProfile).where(
                and_(UserBehaviorProfile.entity_type == EntityType.MACHINE.value,
                     UserBehaviorProfile.entity_label == log.host)
            )
        )
        return result.scalar_one_or_none()
    return None


async def evaluate_log(log: LogEntry, db: AsyncSession) -> List[UEBAAnomaly]:
    """Compare un log unique a la baseline de son entite. Retourne les anomalies creees."""
    profile = await _get_profile_for_log(log, db)
    if not profile:
        return []  # entite jamais bootstrappee -> rien a comparer

    created = []
    hour = log.timestamp.hour if log.timestamp else datetime.now(timezone.utc).hour

    # ── Anomalie horaire (distance circulaire : 23h vs 1h = 2h, pas 22h) ──
    if profile.avg_login_hour is not None:
        raw_dev = abs(hour - profile.avg_login_hour)
        deviation = min(raw_dev, 24 - raw_dev)
        if deviation >= HOUR_DEVIATION_THRESHOLD:
            created.append(await ueba_service.record_anomaly(
                db, profile.id, "time_anomaly",
                f"Connexion à {hour:02d}h — hors horaires habituels (moyenne {profile.avg_login_hour:.0f}h)",
                TIME_ANOMALY_SCORE,
            ))

    # ── Anomalie de volume (proxy : taille du message brut) ───────────────
    if profile.avg_daily_volume_mb and profile.avg_daily_volume_mb > 0:
        estimated_mb = len(log.raw_message or "") / (1024 * 1024)
        ratio = estimated_mb / profile.avg_daily_volume_mb
        if ratio >= VOLUME_RATIO_THRESHOLD:
            created.append(await ueba_service.record_anomaly(
                db, profile.id, "volume_anomaly",
                f"Volume observé {ratio:.1f}x supérieur à la baseline",
                VOLUME_ANOMALY_SCORE,
            ))

    # ── Anomalie de ressource (hors perimetre habituel) ───────────────────
    if profile.usual_hosts and log.host:
        usual = {h.strip() for h in profile.usual_hosts.split(",") if h.strip()}
        if usual and log.host not in usual:
            created.append(await ueba_service.record_anomaly(
                db, profile.id, "resource_anomaly",
                f"Accès à {log.host} — hors périmètre habituel",
                RESOURCE_ANOMALY_SCORE,
            ))

    return created


async def run_batch_detection(db: AsyncSession, lookback_seconds: int = 60) -> int:
    """
    A appeler periodiquement (scheduler, toutes les 30-60s) : evalue tous les
    logs recus depuis le dernier passage. Evite de toucher au pipeline
    d'ingestion existant (Module 1/2) — approche batch plutot que hook temps reel.
    """
    global _last_checkpoint
    now = datetime.now(timezone.utc)
    since = _last_checkpoint or (now - timedelta(seconds=lookback_seconds))

    result = await db.execute(
        select(LogEntry).where(LogEntry.created_at > since).order_by(LogEntry.created_at)
    )
    logs = result.scalars().all()

    total = 0
    for log in logs:
        total += len(await evaluate_log(log, db))

    _last_checkpoint = now
    return total