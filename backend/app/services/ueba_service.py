"""Service UEBA — Module 4 (utilisateurs ET machines, snapshots reels)."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from models.user import CTSUser
from models.log_entry import LogEntry
from models.ueba import UserBehaviorProfile, UEBAAnomaly, UEBAScoreSnapshot
from core.constants import EntityType, UEBA_RISK_THRESHOLD
from models.infrastructure import InfrastructureNode



# ─── Lecture ──────────────────────────────────────────────────────────────

async def list_profiles(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(select(UserBehaviorProfile))
    return [_to_dict(p) for p in result.scalars().all()]


async def _get_profile_orm(entity_id: str, db: AsyncSession) -> Optional[UserBehaviorProfile]:
    result = await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.entity_label == entity_id)
    )
    return result.scalar_one_or_none()


async def get_profile(entity_id: str, db: AsyncSession) -> Optional[Dict[str, Any]]:
    profile = await _get_profile_orm(entity_id, db)
    return _to_dict(profile) if profile else None


def _to_dict(profile: UserBehaviorProfile) -> Dict[str, Any]:
    typical_hours = {}
    if profile.avg_login_hour is not None:
        typical_hours = {str(int(round(profile.avg_login_hour))).zfill(2): 100}
    return {
        "entity_id":       profile.entity_label,
        "entity_type":     profile.entity_type,
        "risk_score":      profile.risk_score or 0.0,
        "avg_data_volume": (profile.avg_daily_volume_mb or 0.0) * 1024 * 1024,
        "typical_hours":   typical_hours,
    }


# ─── Anomalies ────────────────────────────────────────────────────────────

async def get_anomalies(entity_id: str, db: AsyncSession) -> List[UEBAAnomaly]:
    profile = await _get_profile_orm(entity_id, db)
    if not profile:
        return []
    result = await db.execute(
        select(UEBAAnomaly).where(UEBAAnomaly.profile_id == profile.id)
        .order_by(desc(UEBAAnomaly.detected_at))
    )
    return result.scalars().all()


from sqlalchemy import or_
from core.constants import AlertStatus


async def record_anomaly(
    db: AsyncSession, profile_id: uuid.UUID,
    anomaly_type: str, description: str, score_delta: float,
) -> UEBAAnomaly:
    anomaly = UEBAAnomaly(
        profile_id=profile_id, anomaly_type=anomaly_type,
        description=description, score_delta=score_delta,
    )
    db.add(anomaly)

    profile = (await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.id == profile_id)
    )).scalar_one_or_none()

    crossed = False
    if profile:
        before = profile.risk_score or 0.0
        profile.risk_score = min(100.0, before + score_delta)
        profile.last_updated = datetime.now(timezone.utc)
        crossed = before < UEBA_RISK_THRESHOLD <= profile.risk_score

        if profile.entity_type == EntityType.USER.value and profile.user_id:
            user = (await db.execute(select(CTSUser).where(CTSUser.id == profile.user_id))).scalar_one_or_none()
            if user:
                user.risk_score = profile.risk_score  # cache de compat

    await db.commit()
    await db.refresh(anomaly)

    if crossed and profile:
        await _create_alert_from_anomaly(profile, db)

    return anomaly


async def _create_alert_from_anomaly(profile: UserBehaviorProfile, db: AsyncSession):
    """
    Ferme la boucle comportement -> correlation -> SOAR (cahier des charges,
    section 4.8) : cree une Alert quand le risk_score franchit le seuil, et
    declenche les playbooks SOAR associes a son niveau de severite.
    Import local pour eviter tout cycle d'import avec models.alert / services.soar.
    """
    from models.alert import Alert
    from core.constants import AlertSeverity
    from services.soar import trigger_auto_playbooks

    # Evite les doublons : ne recree pas d'alerte si une est deja ouverte pour cette entite
    existing = (await db.execute(
        select(Alert).where(
            and_(
                or_(Alert.username == profile.entity_label, Alert.target_host == profile.entity_label),
                Alert.status != AlertStatus.RESOLVED.value,
            )
        )
    )).scalar_one_or_none()
    if existing:
        return

    severity = AlertSeverity.CRITICAL.value if profile.risk_score >= 75 else AlertSeverity.HIGH.value

    alert = Alert(
        severity=severity,
        title=f"Comportement anormal détecté — {profile.entity_label}",
        description=f"Score de risque UEBA à {profile.risk_score:.0f}/100 "
                     f"pour {profile.entity_type} « {profile.entity_label} ».",
        username=profile.entity_label if profile.entity_type == EntityType.USER.value else None,
        target_host=profile.entity_label if profile.entity_type == EntityType.MACHINE.value else None,
        ueba_score=profile.risk_score,
        mitre_tactic="Exfiltration",
        mitre_technique="T1041",
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    await trigger_auto_playbooks(alert, db)


# ─── Historique reel (snapshots) ──────────────────────────────────────────

async def get_score_history(entity_id: str, days: int, db: AsyncSession) -> List[Dict[str, Any]]:
    profile = await _get_profile_orm(entity_id, db)
    if not profile:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(UEBAScoreSnapshot)
        .where(and_(UEBAScoreSnapshot.profile_id == profile.id, UEBAScoreSnapshot.snapshot_date >= since))
        .order_by(UEBAScoreSnapshot.snapshot_date)
    )
    return [{"date": s.snapshot_date, "score": s.risk_score} for s in result.scalars().all()]


async def snapshot_all_profiles(db: AsyncSession) -> int:
    """A executer 1x/jour (scheduler) : fige le risk_score courant de chaque profil."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    profiles = (await db.execute(select(UserBehaviorProfile))).scalars().all()

    for profile in profiles:
        existing = (await db.execute(
            select(UEBAScoreSnapshot).where(
                and_(UEBAScoreSnapshot.profile_id == profile.id, UEBAScoreSnapshot.snapshot_date == today)
            )
        )).scalar_one_or_none()

        if existing:
            existing.risk_score = profile.risk_score
        else:
            db.add(UEBAScoreSnapshot(profile_id=profile.id, snapshot_date=today, risk_score=profile.risk_score))

    await db.commit()
    return len(profiles)


# ─── Bootstrap baseline (dataset 30 jours) ────────────────────────────────

async def bootstrap_baselines(db: AsyncSession, window_days: int = 30) -> Dict[str, int]:
    """
    Calcule la baseline comportementale de chaque utilisateur ET machine a
    partir des logs ingeres sur les window_days derniers jours.
    """
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    created_users = created_machines = 0

    # ── Baselines utilisateurs ────────────────────────────────────────────
    user_rows = (await db.execute(
        select(
            LogEntry.username,
            func.avg(func.extract("hour", LogEntry.timestamp)).label("avg_hour"),
            func.count(LogEntry.id).label("log_count"),
        )
        .where(and_(LogEntry.timestamp >= since, LogEntry.username.isnot(None)))
        .group_by(LogEntry.username)
    )).all()

    for row in user_rows:
        user = (await db.execute(
            select(CTSUser).where(CTSUser.username == row.username)
        )).scalar_one_or_none()

        profile = (await db.execute(
            select(UserBehaviorProfile).where(
                and_(UserBehaviorProfile.entity_type == EntityType.USER.value,
                     UserBehaviorProfile.entity_label == row.username)
            )
        )).scalar_one_or_none()

        if not profile:
            profile = UserBehaviorProfile(
                entity_type=EntityType.USER.value, entity_label=row.username,
                user_id=user.id if user else None,
            )
            db.add(profile)
            created_users += 1

        profile.avg_login_hour      = float(row.avg_hour or 0)
        profile.avg_daily_volume_mb = (row.log_count * 0.01) / window_days
        profile.last_updated        = datetime.now(timezone.utc)

        # ── Hosts habituels (top 3) — necessaire pour resource_anomaly ────
        # IMPORTANT : row.username existe ici car on est dans la boucle
        # user_rows, pas host_rows.
        host_pref_rows = (await db.execute(
            select(LogEntry.host, func.count(LogEntry.id).label("c"))
            .where(and_(LogEntry.timestamp >= since,
                        LogEntry.username == row.username,
                        LogEntry.host.isnot(None)))
            .group_by(LogEntry.host)
            .order_by(desc("c"))
            .limit(3)
        )).all()
        profile.usual_hosts = ",".join(h.host for h in host_pref_rows)

    # ── Baselines machines (par host) ─────────────────────────────────────
    host_rows = (await db.execute(
        select(
            LogEntry.host,
            func.avg(func.extract("hour", LogEntry.timestamp)).label("avg_hour"),
            func.count(LogEntry.id).label("log_count"),
        )
        .where(and_(LogEntry.timestamp >= since, LogEntry.host.isnot(None)))
        .group_by(LogEntry.host)
    )).all()

    for row in host_rows:
        node = (await db.execute(
            select(InfrastructureNode).where(InfrastructureNode.host == row.host)
        )).scalar_one_or_none()

        profile = (await db.execute(
            select(UserBehaviorProfile).where(
                and_(UserBehaviorProfile.entity_type == EntityType.MACHINE.value,
                     UserBehaviorProfile.entity_label == row.host)
            )
        )).scalar_one_or_none()

        if not profile:
            profile = UserBehaviorProfile(
                entity_type=EntityType.MACHINE.value, entity_label=row.host,
                node_id=node.id if node else None,
            )
            db.add(profile)
            created_machines += 1
        elif node and not profile.node_id:
            profile.node_id = node.id

        profile.avg_login_hour      = float(row.avg_hour or 0)
        profile.avg_daily_volume_mb = (row.log_count * 0.01) / window_days
        profile.last_updated        = datetime.now(timezone.utc)
        # Pas de usual_hosts pour une machine, la notion n'a pas de sens ici
        # (une machine n'accede pas a d'autres "hosts" au sens username/host).

    await db.commit()
    return {"users_profiled": created_users, "machines_profiled": created_machines}