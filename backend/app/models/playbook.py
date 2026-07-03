"""Modeles Playbook et PlaybookExecution."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
from core.constants import PlaybookMode, AlertSeverity


class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(
        SAEnum(PlaybookMode, values_callable=lambda x: [e.value for e in x]),
        default=PlaybookMode.MANUAL.value,
    )
    max_delay_sec:   Mapped[int]            = mapped_column(Integer, default=60)
    # severity_filter : AlertSeverity (INFO/WARNING/HIGH/CRITICAL), PAS LogSeverity —
    # un playbook filtre des ALERTES, pas des logs bruts. Colonne texte simple,
    # même raisonnement que Alert.severity / CorrelationRule.alert_level.
    severity_filter: Mapped[Optional[str]]  = mapped_column(String(20), nullable=True)
    actions:    Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    channels:   Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    is_active:  Mapped[bool]           = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    executions = relationship("PlaybookExecution", back_populates="playbook_obj")

    def __repr__(self):
        return f"<Playbook {self.name} [{self.mode}]>"


class PlaybookExecution(Base):
    __tablename__ = "playbook_executions"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("playbooks.id"), nullable=True
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("alerts.id"), nullable=False
    )
    playbook: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mode:     Mapped[str]           = mapped_column(String(32), default=PlaybookMode.AUTO.value)
    target:   Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status:   Mapped[str]           = mapped_column(String(32), default="pending")
    detail:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    firewall_cmd: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    log_output:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirm_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at:      Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    playbook_obj = relationship("Playbook", back_populates="executions", foreign_keys=[playbook_id])
    alert        = relationship("Alert", back_populates="playbook_executions")

    def __repr__(self):
        return f"<PlaybookExecution {self.playbook} [{self.status}]>"