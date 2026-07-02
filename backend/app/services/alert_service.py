"""
Service Alertes — Module 3.
CRUD alertes, acknowledge, resolve, stats.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, update

from models.alert import Alert, CorrelationRule
from models.playbook import PlaybookExecution
from core.constants import AlertStatus, LogSeverity


# ─── Lecture ─────────────────────────────────────────────────────────────────

async def list_alerts(
    db: AsyncSession,
    severity: Optional[str]  = None,
    status:   Optional[str]  = None,
    source_ip:Optional[str]  = None,
    username: Optional[str]  = None,
    from_dt:  Optional[datetime] = None,
    to_dt:    Optional[datetime] = None,
    page:     int = 1,
    size:     int = 50,
) -> Dict[str, Any]:
    filters = []
    if severity:  filters.append(Alert.severity  == severity)
    if status:    filters.append(Alert.status     == status)
    if source_ip: filters.append(Alert.source_ip == source_ip)
    if username:  filters.append(Alert.username   == username)
    if from_dt:   filters.append(Alert.triggered_at >= from_dt)
    if to_dt:     filters.append(Alert.triggered_at <= to_dt)

    base_q = select(Alert)
    if filters:
        base_q = base_q.where(and_(*filters))

    total = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (page - 1) * size
    rows = (await db.execute(
        base_q.order_by(desc(Alert.triggered_at)).offset(offset).limit(size)
    )).scalars().all()

    return {"total": total, "page": page, "size": size, "results": rows}


async def get_alert(alert_id: uuid.UUID, db: AsyncSession) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    return result.scalar_one_or_none()


async def get_alert_by_str_id(alert_str_id: str, db: AsyncSession) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.alert_id == alert_str_id))
    return result.scalar_one_or_none()


# ─── Transitions de statut ────────────────────────────────────────────────────

async def acknowledge_alert(
    alert: Alert,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Alert:
    alert.status         = AlertStatus.ACKNOWLEDGED.value
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.assigned_to    = user_id
    await db.commit()
    await db.refresh(alert)
    return alert


async def resolve_alert(alert: Alert, db: AsyncSession) -> Alert:
    alert.status      = AlertStatus.RESOLVED.value
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


# ─── Statistiques dashboard ───────────────────────────────────────────────────

async def get_alert_stats(db: AsyncSession) -> Dict[str, Any]:
    """KPIs alertes pour le dashboard Module 3."""
    # Comptage par severite
    sev_counts = {}
    for sev in LogSeverity:
        count = (await db.execute(
            select(func.count(Alert.id)).where(Alert.severity == sev.value)
        )).scalar_one()
        sev_counts[sev.value] = count

    # Comptage par statut
    stat_counts = {}
    for st in AlertStatus:
        count = (await db.execute(
            select(func.count(Alert.id)).where(Alert.status == st.value)
        )).scalar_one()
        stat_counts[st.value] = count

    # Total
    total = (await db.execute(select(func.count(Alert.id)))).scalar_one()

    # 5 alertes les plus recentes
    recent = (await db.execute(
        select(Alert).order_by(desc(Alert.triggered_at)).limit(5)
    )).scalars().all()

    # Top sources IP
    top_ips_rows = (await db.execute(
        select(Alert.source_ip, func.count(Alert.id).label("count"))
        .where(Alert.source_ip != None)
        .group_by(Alert.source_ip)
        .order_by(desc("count"))
        .limit(8)
    )).all()
    top_ips = [{"ip": r.source_ip, "count": r.count} for r in top_ips_rows]

    return {
        "total":          total,
        "by_severity":    sev_counts,
        "by_status":      stat_counts,
        "recent":         recent,
        "top_source_ips": top_ips,
    }


# ─── Executions SOAR d'une alerte ────────────────────────────────────────────

async def get_alert_executions(alert_id: uuid.UUID, db: AsyncSession) -> List[PlaybookExecution]:
    result = await db.execute(
        select(PlaybookExecution)
        .where(PlaybookExecution.alert_id == alert_id)
        .order_by(PlaybookExecution.created_at)
    )
    return result.scalars().all()


async def cancel_execution(exec_id: uuid.UUID, db: AsyncSession) -> Optional[PlaybookExecution]:
    result = await db.execute(
        select(PlaybookExecution).where(PlaybookExecution.id == exec_id)
    )
    ex = result.scalar_one_or_none()
    if not ex:
        return None
    ex.status = "cancelled"
    await db.commit()
    await db.refresh(ex)
    return ex


async def confirm_execution(
    exec_id: uuid.UUID,
    alert: Alert,
    db: AsyncSession,
) -> Optional[PlaybookExecution]:
    """Force l'execution immediate d'un playbook en attente de confirmation."""
    from services.soar import execute_playbook
    result = await db.execute(
        select(PlaybookExecution).where(PlaybookExecution.id == exec_id)
    )
    ex = result.scalar_one_or_none()
    if not ex:
        return None
    # Annuler le delai de grace
    ex.confirm_deadline = datetime.now(timezone.utc)
    await db.commit()
    await execute_playbook(ex, alert, db)
    await db.refresh(ex)
    return ex