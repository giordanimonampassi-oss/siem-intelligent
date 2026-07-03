"""Endpoints logs — /api/v1/logs — Modules 1, 2, 3."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case
from elasticsearch import AsyncElasticsearch

from api.v1.dependencies import get_db, get_es, get_current_user, require_analyst, require_auditor
from models.log_entry import LogEntry
from models.user import CTSUser
from schemas.log_schemas import (
    LogIngest, LogBatchIngest, LogResponse, LogDetail,
    LogSearchParams, LogSearchResult, LogMarkSuspicious, BatchIntegrityResponse,
)
from models.incident import Incident
from services import log_service
from services.auth_service import log_audit
from services.correlator import process_log_for_alerts
from services.soar import trigger_auto_playbooks
from core.constants import LogSeverity, LogType
from sqlalchemy import or_

router = APIRouter(prefix="/logs", tags=["Logs — Modules 1, 2, 3"])


async def _run_correlation(log: LogEntry, db: AsyncSession) -> None:
    """Pipeline correlation -> alertes -> SOAR, en arriere-plan."""
    try:
        alerts = await process_log_for_alerts(log, db)
        for alert in alerts:
            if alert.severity in (LogSeverity.CRITICAL.value, LogSeverity.WARNING.value):
                await trigger_auto_playbooks(alert, db)
    except Exception as exc:
        print(f"[CORRELATOR] Erreur correlation log {log.id}: {exc}")


async def _correlate_batch(batch_id: str, db: AsyncSession) -> None:
    try:
        result = await db.execute(select(LogEntry).where(LogEntry.batch_id == batch_id))
        logs = result.scalars().all()
        for log in logs:
            alerts = await process_log_for_alerts(log, db)
            for alert in alerts:
                if alert.severity in (LogSeverity.CRITICAL.value, LogSeverity.WARNING.value):
                    await trigger_auto_playbooks(alert, db)
    except Exception as exc:
        print(f"[CORRELATOR] Erreur correlation batch {batch_id}: {exc}")


@router.post("", response_model=LogResponse, status_code=201)
async def ingest_log(
    payload: LogIngest, request: Request, background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db), es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    """Ingestion unique. Pipeline: normalisation -> PG -> ES -> correlation (background)."""
    entry = await log_service.ingest_log(payload, db, es)
    background_tasks.add_task(_run_correlation, entry, db)

    await log_audit("log_ingested", db, user_id=current_user.id, target=f"log#{entry.id}",
                    ip=request.client.host if request.client else None)
    await db.commit()

    return LogResponse(log_id=entry.id, timestamp=entry.timestamp, severity=entry.severity,
                       log_type=entry.log_type, batch_id=entry.batch_id, es_indexed=entry.es_indexed)


@router.post("/batch", status_code=201)
async def ingest_batch(
    payload: LogBatchIngest, request: Request, background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db), es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    """Ingestion par lot (max 500), correlation lancee en arriere-plan."""
    result = await log_service.ingest_batch(payload, db, es)
    entries = result.pop("entries", [])

    if result.get("ingested", 0) > 0:
        background_tasks.add_task(_correlate_batch, result["batch_id"], db)

    await log_audit("batch_ingested", db, user_id=current_user.id, target=result["batch_id"],
                    detail=f"{result['ingested']} logs", ip=request.client.host if request.client else None)
    await db.commit()
    return result


@router.get("", response_model=LogSearchResult)
async def search_logs(
    source_ip: Optional[str] = Query(None), dest_ip: Optional[str] = Query(None),
    username: Optional[str] = Query(None), host: Optional[str] = Query(None),
    log_type: Optional[LogType] = Query(None), severity: Optional[LogSeverity] = Query(None),
    from_dt: Optional[str] = Query(None), to_dt: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None), engine: str = Query("es"),
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db), es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(get_current_user),
):
    from datetime import datetime
    params = LogSearchParams(
        source_ip=source_ip, dest_ip=dest_ip, username=username, host=host,
        log_type=log_type, severity=severity, keyword=keyword, page=page, size=size,
        from_dt=datetime.fromisoformat(from_dt.replace("Z", "+00:00")) if from_dt else None,
        to_dt=datetime.fromisoformat(to_dt.replace("Z", "+00:00")) if to_dt else None,
    )
    if engine == "pg":
        return await log_service.search_logs_pg(params, db)
    return await log_service.search_logs_es(params, es)


@router.get("/health")
async def logs_health(db: AsyncSession = Depends(get_db), es: AsyncElasticsearch = Depends(get_es)):
    pg_ok, es_ok = False, False
    try:
        await db.execute(select(1))
        pg_ok = True
    except Exception:
        pass
    try:
        es_ok = await es.ping()
    except Exception:
        pass
    return {"postgresql": "ok" if pg_ok else "error", "elasticsearch": "ok" if es_ok else "error",
            "status": "healthy" if (pg_ok and es_ok) else "degraded"}


@router.get("/stats", response_model=dict)
async def get_logs_stats(
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
    current_user = Depends(get_current_user),
    hours: int = Query(24, ge=1, le=168, description="Période en heures (1 à 7 jours)"),
):
    """Statistiques pour le dashboard."""
    from datetime import datetime, timedelta
    from sqlalchemy import func, desc, select

    start_time = datetime.utcnow() - timedelta(hours=hours)

    total_logs = await db.execute(
        select(func.count(LogEntry.id)).where(LogEntry.created_at >= start_time)
    )
    logs_last_hour = await db.execute(
        select(func.count(LogEntry.id)).where(
            LogEntry.created_at >= datetime.utcnow() - timedelta(hours=1)
        )
    )

    severity_stats = await db.execute(
        select(
            LogEntry.severity,
            func.count(LogEntry.id).label("count")
        )
        .where(LogEntry.created_at >= start_time)
        .group_by(LogEntry.severity)
    )
    by_severity = {str(row.severity): row.count for row in severity_stats}

    type_stats = await db.execute(
        select( 
            LogEntry.log_type,
            func.count(LogEntry.id).label("count")
        )
        .where(LogEntry.created_at >= start_time)
        .group_by(LogEntry.log_type)
    )
    by_type = {str(row.log_type): row.count for row in type_stats}

    top_ips = await db.execute(
        select(
            LogEntry.source_ip,
            func.count(LogEntry.id).label("count")
        )
        .where(LogEntry.created_at >= start_time)
        .where(LogEntry.source_ip.isnot(None))
        .where(LogEntry.source_ip != '')
        .group_by(LogEntry.source_ip)
        .order_by(desc("count"))
        .limit(10)
    )
    top_source_ips = [
        {"ip": row.source_ip, "count": int(row.count)} 
        for row in top_ips if row.source_ip
    ]

    # ── Volume horaire pour le graphique ─────────────────────────────
    hourly_stats = await db.execute(
        select(
            func.date_trunc('hour', LogEntry.created_at).label("hour"),
            func.count(LogEntry.id).label("total"),
            func.count(case((LogEntry.severity == 'critical', 1), else_=None)).label("critical")
        )
        .where(LogEntry.created_at >= start_time)
        .group_by("hour")
        .order_by("hour")
    )

    hourly_volume = [
        {
            "hour": row.hour.strftime("%Hh"),
            "total": row.total,
            "critical": row.critical or 0
        }
        for row in hourly_stats
    ]
    open_incidents_count = (await db.execute(
    select(func.count(Incident.id)).where(
        or_(Incident.status == "OPEN", Incident.status == "IN_PROGRESS")
    )
)).scalar_one()

    return {
        "total_logs": total_logs.scalar() or 0,
        "logs_last_hour": logs_last_hour.scalar() or 0,
        "by_severity": by_severity,
        "by_type": by_type,
        "top_source_ips": top_source_ips,
        "hourly_volume": hourly_volume,          # ← Ajout important
        "open_incidents": open_incidents_count,
        "period_hours": hours,
        "timestamp": datetime.utcnow().isoformat()
    }



@router.get("/{log_id}", response_model=LogDetail)
async def get_log(log_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: CTSUser = Depends(get_current_user)):
    result = await db.execute(select(LogEntry).where(LogEntry.id == log_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Log introuvable")
    return LogDetail.model_validate(entry)


@router.patch("/{log_id}/flag", response_model=LogDetail)
async def flag_log(
    log_id: uuid.UUID, payload: LogMarkSuspicious, request: Request,
    db: AsyncSession = Depends(get_db), es: AsyncElasticsearch = Depends(get_es),
    current_user: CTSUser = Depends(require_analyst),
):
    entry = await log_service.mark_suspicious(log_id, payload.is_suspicious, payload.note, db, es)
    if not entry:
        raise HTTPException(status_code=404, detail="Log introuvable")
    await log_audit("log_flagged", db, user_id=current_user.id, target=str(log_id),
                    ip=request.client.host if request.client else None)
    await db.commit()
    return LogDetail.model_validate(entry)


@router.get("/integrity/{batch_id}", response_model=BatchIntegrityResponse)
async def verify_integrity(batch_id: str, db: AsyncSession = Depends(get_db), current_user: CTSUser = Depends(require_auditor)):
    return await log_service.get_batch_integrity(batch_id, db)