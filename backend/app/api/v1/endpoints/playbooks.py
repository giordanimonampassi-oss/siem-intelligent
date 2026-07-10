"""Endpoints Playbooks SOAR — /api/v1/playbooks (catalogue + executions, Module 3)."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update

from api.v1.dependencies import get_db, get_current_user, require_analyst
from models.user import CTSUser
from models.playbook import Playbook, PlaybookExecution
from schemas.alert_schemas import (
    PlaybookExecutionResponse, PlaybookCreate, PlaybookUpdate,
    PlaybookResponse, PlaybookDetailResponse,
)

router = APIRouter(prefix="/playbooks", tags=["Playbooks SOAR — Module 3"])


# ── IMPORTANT : les routes statiques ("", "/executions") doivent etre
# declarees AVANT la route dynamique "/{playbook_id}", sinon FastAPI tente
# de parser "executions" comme un UUID et renvoie 422.

@router.get("", response_model=list[PlaybookResponse])
async def list_playbooks(
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Catalogue des playbooks configures."""
    rows = (await db.execute(
        select(Playbook).order_by(desc(Playbook.created_at))
    )).scalars().all()
    return [PlaybookResponse.model_validate(p) for p in rows]


@router.post("", response_model=PlaybookResponse)
async def create_playbook(
    payload: PlaybookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    """Cree un nouveau playbook dans le catalogue."""
    pb = Playbook(**payload.model_dump())
    db.add(pb)
    await db.commit()
    await db.refresh(pb)
    return PlaybookResponse.model_validate(pb)


@router.get("/executions", response_model=list[PlaybookExecutionResponse])
async def list_executions(
    status: Optional[str] = Query(None),
    size: int = Query(30, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Vue globale de toutes les executions SOAR recentes."""
    q = select(PlaybookExecution).order_by(desc(PlaybookExecution.created_at)).limit(size)
    if status:
        q = q.where(PlaybookExecution.status == status)
    rows = (await db.execute(q)).scalars().all()
    return [PlaybookExecutionResponse.model_validate(e) for e in rows]


@router.get("/{playbook_id}", response_model=PlaybookDetailResponse)
async def get_playbook(
    playbook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(get_current_user),
):
    """Detail d'un playbook + ses 20 dernieres executions."""
    pb = (await db.execute(select(Playbook).where(Playbook.id == playbook_id))).scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook introuvable")

    execs = (await db.execute(
        select(PlaybookExecution)
        .where(PlaybookExecution.playbook_id == playbook_id)
        .order_by(desc(PlaybookExecution.created_at))
        .limit(20)
    )).scalars().all()

    base = PlaybookResponse.model_validate(pb).model_dump()
    return PlaybookDetailResponse(
        **base,
        recent_executions=[PlaybookExecutionResponse.model_validate(e) for e in execs],
    )


@router.patch("/{playbook_id}", response_model=PlaybookResponse)
async def update_playbook(
    playbook_id: uuid.UUID,
    payload: PlaybookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    pb = (await db.execute(select(Playbook).where(Playbook.id == playbook_id))).scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pb, key, value)
    await db.commit()
    await db.refresh(pb)
    return PlaybookResponse.model_validate(pb)

@router.delete("/{playbook_id}")
async def delete_playbook(
    playbook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CTSUser = Depends(require_analyst),
):
    pb = (await db.execute(select(Playbook).where(Playbook.id == playbook_id))).scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook introuvable")

    # Detache les executions existantes avant suppression (sinon violation
    # de contrainte FK — playbook_executions.playbook_id les referencait).
    await db.execute(
        update(PlaybookExecution).where(PlaybookExecution.playbook_id == playbook_id).values(playbook_id=None)
    )
    await db.delete(pb)
    await db.commit()
    return {"message": f"Playbook '{pb.name}' supprimé"}