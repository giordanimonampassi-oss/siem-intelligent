from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from models.incident import Incident, IncidentNote
from schemas.incident_schemas import (
    IncidentCreate, IncidentUpdate, StatusChangeRequest, NoteCreate
)


async def list_incidents(db: AsyncSession, status: str = None):
    query = select(Incident).order_by(Incident.created_at.desc())
    if status:
        query = query.where(Incident.status == status)
    result = await db.execute(query)
    return result.scalars().all()


async def create_incident(payload: IncidentCreate, db: AsyncSession, current_user):
    incident = Incident(**payload.model_dump())
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


async def get_incident(incident_id: UUID, db: AsyncSession):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    return result.scalar_one_or_none()


async def update_incident(incident_id: UUID, payload: IncidentUpdate, db: AsyncSession):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)

    await db.commit()
    await db.refresh(incident)
    return incident


async def add_note(incident_id: UUID, payload: NoteCreate, db: AsyncSession, current_user):
    note = IncidentNote(
        incident_id=incident_id,
        author=current_user.username,
        content=payload.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note