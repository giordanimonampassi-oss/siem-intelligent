"""
Endpoints Incidents — /api/v1/incidents
Gestion des incidents de sécurité (création, mise à jour, statut, notes).
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.dependencies import get_db, get_current_user, require_analyst
from schemas.incident_schemas import (
    IncidentCreate, 
    IncidentDetail as IncidentResponse,   # ← Utilise IncidentDetail
    IncidentUpdate,
    StatusChangeRequest,
    NoteCreate,
    NoteOut
)
from services import incident_service

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("")
async def list_incidents(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    incidents = await incident_service.list_incidents(db, status)
    return {"items": incidents}


@router.post("", response_model=IncidentResponse)
async def create_incident(
    payload: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_analyst),
):
    incident = await incident_service.create_incident(payload, db, current_user)
    return incident


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    incident = await incident_service.get_incident(incident_id, db)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_analyst),
):
    incident = await incident_service.update_incident(incident_id, payload, db)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    return incident


@router.post("/{incident_id}/status")
async def change_status(
    incident_id: uuid.UUID,
    payload: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_analyst),
):
    incident = await incident_service.change_status(incident_id, payload, db, current_user)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    return incident


@router.post("/{incident_id}/notes", response_model=NoteOut)
async def add_note(
    incident_id: uuid.UUID,
    payload: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_analyst),
):
    note = await incident_service.add_note(incident_id, payload, db, current_user)
    return note