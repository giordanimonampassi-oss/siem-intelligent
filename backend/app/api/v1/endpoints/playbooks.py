"""Endpoints Playbooks SOAR — /api/v1/playbooks (vue globale, Module 3)."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from api.v1.dependencies import get_db, get_current_user
from models.user import CTSUser
from models.playbook import PlaybookExecution
from schemas.alert_schemas import PlaybookExecutionResponse

router = APIRouter(prefix="/playbooks", tags=["Playbooks SOAR — Module 3"])


@router.get("/executions", response_model=list[PlaybookExecutionResponse])
async def list_executions(
    status: Optional[str] = Query(None),
    size:   int           = Query(30, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """
    Vue globale de toutes les executions SOAR recentes, tous types
    d'alertes confondus — remplace l'agregation cote frontend qui
    interrogeait /alerts puis /alerts/{id}/executions en boucle.
    """
    q = select(PlaybookExecution).order_by(desc(PlaybookExecution.created_at)).limit(size)
    if status:
        q = q.where(PlaybookExecution.status == status)
    rows = (await db.execute(q)).scalars().all()
    return [PlaybookExecutionResponse.model_validate(e) for e in rows]