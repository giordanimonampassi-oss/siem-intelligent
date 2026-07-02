"""
Endpoints Alertes — /api/v1/alerts
Module 3 : lecture, stats, acknowledge, resolve, executions SOAR.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_analyst
from models.user import CTSUser
from schemas.alert_schemas import (
    AlertResponse, AlertListResponse, AlertStatsResponse,
    AlertUpdateStatus, PlaybookExecutionResponse,
)
from services import alert_service, soar as soar_service
from services.auth_service import log_audit
from core.constants import LogSeverity

router = APIRouter(prefix="/alerts", tags=["Alertes — Module 3"])


# ─── Stats dashboard ──────────────────────────────────────────────────────────

@router.get("/stats", response_model=AlertStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """KPIs alertes — critique, elevee, warning, par statut, top IPs."""
    stats = await alert_service.get_alert_stats(db)
    return AlertStatsResponse(
        total=stats["total"],
        by_severity=stats["by_severity"],
        by_status=stats["by_status"],
        top_source_ips=stats["top_source_ips"],
    )


# ─── Liste des alertes ────────────────────────────────────────────────────────

@router.get("", response_model=AlertListResponse)
async def list_alerts(
    severity:  Optional[str] = Query(None, description="CRITICAL|HIGH|WARNING|INFO"),
    status:    Optional[str] = Query(None, description="NEW|ACKNOWLEDGED|RESOLVED"),
    source_ip: Optional[str] = Query(None),
    username:  Optional[str] = Query(None),
    from_dt:   Optional[str] = Query(None, description="ISO 8601"),
    to_dt:     Optional[str] = Query(None, description="ISO 8601"),
    page:      int           = Query(1, ge=1),
    size:      int           = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Liste paginees des alertes avec filtres."""
    from datetime import datetime
    result = await alert_service.list_alerts(
        db=db,
        severity=severity,
        status=status,
        source_ip=source_ip,
        username=username,
        from_dt=datetime.fromisoformat(from_dt.replace("Z", "+00:00")) if from_dt else None,
        to_dt=datetime.fromisoformat(to_dt.replace("Z", "+00:00")) if to_dt else None,
        page=page,
        size=size,
    )
    return AlertListResponse(
        total=result["total"],
        page=result["page"],
        size=result["size"],
        results=[AlertResponse.model_validate(a) for a in result["results"]],
    )


# ─── Detail d'une alerte ─────────────────────────────────────────────────────

@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    alert = await alert_service.get_alert(alert_id, db)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    return AlertResponse.model_validate(alert)


# ─── Acknowledge ─────────────────────────────────────────────────────────────

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge(
    alert_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    alert = await alert_service.get_alert(alert_id, db)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    if alert.status != "NEW":
        raise HTTPException(status_code=400, detail=f"Alerte deja {alert.status}")

    alert = await alert_service.acknowledge_alert(alert, current_user.id, db)
    await log_audit("alert_acknowledged", db, user_id=current_user.id,
                    target=str(alert_id), ip=request.client.host if request.client else None)
    await db.commit()
    return AlertResponse.model_validate(alert)


# ─── Resolve ─────────────────────────────────────────────────────────────────

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve(
    alert_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    alert = await alert_service.get_alert(alert_id, db)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    alert = await alert_service.resolve_alert(alert, db)
    await log_audit("alert_resolved", db, user_id=current_user.id,
                    target=str(alert_id), ip=request.client.host if request.client else None)
    await db.commit()
    return AlertResponse.model_validate(alert)


# ─── Trigger manuel SOAR ──────────────────────────────────────────────────────

@router.post("/{alert_id}/trigger-soar")
async def trigger_soar(
    alert_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Declenche manuellement les playbooks SOAR pour une alerte."""
    alert = await alert_service.get_alert(alert_id, db)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    executions = await soar_service.trigger_auto_playbooks(alert, db)
    await log_audit("soar_triggered", db, user_id=current_user.id,
                    target=str(alert_id), ip=request.client.host if request.client else None)
    await db.commit()

    return {
        "alert_id":   str(alert_id),
        "executions": len(executions),
        "message":    f"{len(executions)} playbook(s) declenche(s)",
    }


# ─── Executions SOAR d'une alerte ────────────────────────────────────────────

@router.get("/{alert_id}/executions", response_model=list[PlaybookExecutionResponse])
async def get_executions(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    alert = await alert_service.get_alert(alert_id, db)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    execs = await alert_service.get_alert_executions(alert_id, db)
    return [PlaybookExecutionResponse.model_validate(e) for e in execs]


@router.post("/executions/{exec_id}/confirm", response_model=PlaybookExecutionResponse)
async def confirm_exec(
    exec_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Confirme un playbook en attente (mode SEMI_AUTO)."""
    from sqlalchemy import select
    from models.playbook import PlaybookExecution
    result = await db.execute(select(PlaybookExecution).where(PlaybookExecution.id == exec_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Execution introuvable")
    alert = await alert_service.get_alert(ex.alert_id, db)
    ex = await alert_service.confirm_execution(exec_id, alert, db)
    return PlaybookExecutionResponse.model_validate(ex)


@router.post("/executions/{exec_id}/cancel", response_model=PlaybookExecutionResponse)
async def cancel_exec(
    exec_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Annule un playbook en attente de confirmation."""
    ex = await alert_service.cancel_execution(exec_id, db)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution introuvable")
    return PlaybookExecutionResponse.model_validate(ex)