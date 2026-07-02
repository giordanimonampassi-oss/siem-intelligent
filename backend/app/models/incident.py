"""
Modele de donnees SQLAlchemy pour les incidents SIEM.

Principe de decoupage :
- Les LOGS BRUTS restent dans Elasticsearch (volume trop important pour Postgres).
- POSTGRES stocke uniquement la couche METIER de l'incident : statut, criticite,
  actions SOAR, notes d'investigation, historique des changements de statut.
- La table `incidents.correlated_event_ids` reference les IDs des documents
  Elasticsearch a l'origine de l'incident (recuperes a la volee via le service ES).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text,
    Enum as SAEnum, ARRAY, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .enums import Severity, IncidentStatus, ActionType, ActionMode, ActionStatus
from db.database import Base


def gen_reference() -> str:
    """Genere une reference humaine du type INC-2026-3F2A (visible dans l'UI)."""
    year = datetime.utcnow().year
    suffix = uuid.uuid4().hex[:4].upper()
    return f"INC-{year}-{suffix}"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(
    UUID(as_uuid=True), 
    primary_key=True, 
    default=uuid.uuid4, 
    nullable=False
    )
    reference = Column(String(20), unique=True, nullable=False, default=gen_reference, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    severity = Column(SAEnum(Severity, name="incident_severity"), nullable=False, index=True)
    status = Column(
        SAEnum(IncidentStatus, name="incident_status"),
        nullable=False, default=IncidentStatus.OPEN, index=True,
    )
    confidence_score = Column(Integer, nullable=False, default=0)

    mitre_tactic = Column(String(100), nullable=True)      # ex: "TA0010 - Exfiltration"
    mitre_technique = Column(String(100), nullable=True)    # ex: "T1041"

    # IDs des documents Elasticsearch corrélés à l'origine de l'incident
    correlated_event_ids = Column(ARRAY(String), nullable=False, default=list)
    # Entites impliquees, denormalisees pour filtrage rapide cote liste
    # ex: [{"type": "ip", "value": "178.43.12.87"}, {"type": "compte_service", "value": "CTU-SVC-003"}]
    entities = Column(JSONB, nullable=False, default=list)

    correlation_rule_id = Column(String(100), nullable=True)  # regle ayant declenche l'incident
    playbook_id = Column(String(100), nullable=True)          # playbook SOAR associe

    assigned_to = Column(String(100), nullable=True)  # username de l'analyste assigne

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    actions = relationship("IncidentAction", back_populates="incident", cascade="all, delete-orphan")
    notes = relationship("IncidentNote", back_populates="incident", cascade="all, delete-orphan")
    status_history = relationship(
        "IncidentStatusHistory", back_populates="incident", cascade="all, delete-orphan",
        order_by="IncidentStatusHistory.changed_at",
    )

    __table_args__ = (
        Index("ix_incidents_severity_status", "severity", "status"),
        Index("ix_incidents_created_at", "created_at"),
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 100", name="ck_confidence_score_range"),
    )


class IncidentAction(Base):
    """Action SOAR liee a un incident (auto, en attente de confirmation, ou manuelle)."""
    __tablename__ = "incident_actions"

    id = Column(
    UUID(as_uuid=True), 
    primary_key=True, 
    default=uuid.uuid4, 
    nullable=False
    )
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)

    action_type = Column(SAEnum(ActionType, name="incident_action_type"), nullable=False)
    mode = Column(SAEnum(ActionMode, name="incident_action_mode"), nullable=False)
    status = Column(
        SAEnum(ActionStatus, name="incident_action_status"),
        nullable=False, default=ActionStatus.PENDING,
    )

    target = Column(String(255), nullable=True)  # ex: IP bloquee, compte desactive, machine isolee
    details = Column(JSONB, nullable=True)

    triggered_by = Column(String(100), nullable=True)  # "system" (auto) ou username (manuel)
    scheduled_execution_at = Column(DateTime, nullable=True)  # mode CONFIRM : +60s avant execution
    executed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="actions")

    __table_args__ = (
        Index("ix_actions_status_scheduled", "status", "scheduled_execution_at"),
    )


class IncidentNote(Base):
    """Note d'investigation ajoutee par un analyste (collaboration multi-analystes)."""
    __tablename__ = "incident_notes"

    id = Column(
    UUID(as_uuid=True), 
    primary_key=True, 
    default=uuid.uuid4, 
    nullable=False
    )
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)

    author = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="notes")


class IncidentStatusHistory(Base):
    """Journal des changements de statut - tracabilite / audit (section 4.7)."""
    __tablename__ = "incident_status_history"

    id = Column(
    UUID(as_uuid=True), 
    primary_key=True, 
    default=uuid.uuid4, 
    nullable=False
    )
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)

    from_status = Column(SAEnum(IncidentStatus, name="incident_status"), nullable=True)
    to_status = Column(SAEnum(IncidentStatus, name="incident_status"), nullable=False)
    changed_by = Column(String(100), nullable=False)
    reason = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="status_history")