"""
Schemas Pydantic pour la validation des entrees/sorties de l'API Incidents.
"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from models.enums import ActionMode, ActionStatus, ActionType, EntityType, IncidentStatus, Severity


class EntityRef(BaseModel):
    type: EntityType
    value: str


# ---------- Creation (appelee par le moteur de correlation, section 4.3) ----------

class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: Severity
    confidence_score: int = Field(ge=0, le=100)
    mitre_tactic: Optional[str] = None
    mitre_technique: Optional[str] = None
    correlated_event_ids: list[str] = Field(default_factory=list)
    entities: list[EntityRef] = Field(default_factory=list)
    correlation_rule_id: Optional[str] = None
    playbook_id: Optional[str] = None


# ---------- Changement de statut ----------

class StatusChangeRequest(BaseModel):
    new_status: IncidentStatus
    reason: Optional[str] = None
    changed_by: str  # a terme : injecte depuis le token JWT, pas depuis le body


# ---------- Notes d'investigation ----------

class NoteCreate(BaseModel):
    author: str
    content: str = Field(min_length=1, max_length=4000)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    author: str
    content: str
    created_at: datetime


# ---------- Actions SOAR ----------

class ActionCreate(BaseModel):
    action_type: ActionType
    mode: ActionMode
    target: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    triggered_by: str


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action_type: ActionType
    mode: ActionMode
    status: ActionStatus
    target: Optional[str] = None
    triggered_by: Optional[str] = None
    scheduled_execution_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    created_at: datetime


# ---------- Sorties liste / detail ----------

class IncidentListItem(BaseModel):
    """Version allegee pour la vue liste (ecran principal)."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    reference: str
    title: str
    severity: Severity
    status: IncidentStatus
    confidence_score: int
    mitre_tactic: Optional[str] = None
    entities: list[dict]
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class IncidentDetail(BaseModel):
    """Version complete pour la vue detail / investigation."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    reference: str
    title: str
    description: Optional[str] = None
    severity: Severity
    status: IncidentStatus
    confidence_score: int
    mitre_tactic: Optional[str] = None
    mitre_technique: Optional[str] = None
    correlated_event_ids: list[str]
    entities: list[dict]
    correlation_rule_id: Optional[str] = None
    playbook_id: Optional[str] = None
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    actions: list[ActionOut] = []
    notes: list[NoteOut] = []
    correlated_events: list[dict] = []  # rempli depuis Elasticsearch a la lecture


class IncidentStatsOut(BaseModel):
    """Compteurs pour l'en-tete du dashboard ('3 CRITICAL ouverts', etc.)."""
    by_severity: dict[str, int]
    by_status: dict[str, int]
    total_open: int

class IncidentUpdate(BaseModel):
    """Mise à jour partielle d'un incident."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[IncidentStatus] = None
    assigned_to: Optional[str] = None
    severity: Optional[Severity] = None