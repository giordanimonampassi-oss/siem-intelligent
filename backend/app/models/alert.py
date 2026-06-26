"""Modèles Alert et CorrelationRule — alignés sur le modèle BDD."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, Text, JSON, ForeignKey, Enum as SAEnum, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
from core.constants import AlertStatus, LogSeverity, RuleType


class CorrelationRule(Base):
    __tablename__ = "correlation_rules"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name:             Mapped[str]           = mapped_column(String(255), nullable=False)
    rule_type:        Mapped[str]           = mapped_column(
        SAEnum(RuleType, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    mitre_tactic:     Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mitre_technique:  Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action:           Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_keyword:   Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    threshold:        Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    window_seconds:   Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cooldown_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ip_address:       Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    details:          Mapped[Optional[dict]]= mapped_column(JSON, nullable=True)
    source_log_ids:   Mapped[Optional[list]]= mapped_column(JSON, nullable=True)
    is_active:        Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at:       Mapped[datetime]      = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    alerts = relationship("Alert", back_populates="rule")

    def __repr__(self):
        return f"<CorrelationRule {self.name} [{self.rule_type}]>"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id:    Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    rule_id:     Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("correlation_rules.id"), nullable=True
    )
    severity:    Mapped[str] = mapped_column(
        SAEnum(LogSeverity, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    status:      Mapped[str] = mapped_column(
        SAEnum(AlertStatus, values_callable=lambda x: [e.value for e in x]),
        default=AlertStatus.NEW.value,
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=True
    )
    title:           Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    description:     Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    source_ip:       Mapped[Optional[str]]  = mapped_column(String(45), nullable=True)
    target_host:     Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    username:        Mapped[Optional[str]]  = mapped_column(String(150), nullable=True)
    confidence:      Mapped[Optional[float]]= mapped_column(nullable=True)
    mitre_tactic:    Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    mitre_technique: Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    playbook_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actions_taken:   Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at:      Mapped[datetime]       = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rule          = relationship("CorrelationRule", back_populates="alerts")
    assigned_user = relationship("CTSUser", back_populates="alerts", foreign_keys=[assigned_to])
    playbook_executions = relationship("PlaybookExecution", back_populates="alert")

    def __repr__(self):
        return f"<Alert {self.alert_id} [{self.severity}/{self.status}]>"