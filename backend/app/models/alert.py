"""
Modeles Alert et CorrelationRule — Module 3.
Alignes sur le modele BDD du camarade + champs supplementaires Module 3.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean, DateTime, Float, Integer, String, Text,
    JSON, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base
from core.constants import AlertStatus, LogSeverity, RuleType


class CorrelationRule(Base):
    __tablename__ = "correlation_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name:              Mapped[str]           = mapped_column(String(255), nullable=False, index=True)
    description:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rule_type:         Mapped[str]           = mapped_column(
        SAEnum(RuleType, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=RuleType.THRESHOLD.value,
    )

    # MITRE ATT&CK
    mitre_tactic:    Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mitre_technique: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Logique de declenchement
    log_type_filter:   Mapped[Optional[str]] = mapped_column(String(50),  nullable=True)
    event_field:       Mapped[Optional[str]] = mapped_column(String(64),  nullable=True)  # champ de contexte (source_ip, username...)
    target_keyword:    Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    threshold:         Mapped[Optional[int]] = mapped_column(Integer,     nullable=True)   # nb evenements pour threshold
    time_window_sec:   Mapped[Optional[int]] = mapped_column(Integer,     nullable=True)   # fenetre glissante (secondes)
    window_seconds:    Mapped[Optional[int]] = mapped_column(Integer,     nullable=True)   # alias (compatibilite)
    cooldown_minutes:  Mapped[Optional[int]] = mapped_column(Integer,     nullable=True)
    pattern_sequence:  Mapped[Optional[str]] = mapped_column(Text,        nullable=True)   # JSON pour regles pattern

    # Alerte produite
    alert_level:       Mapped[str]            = mapped_column(
        SAEnum(LogSeverity, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=LogSeverity.WARNING.value,
    )
    confidence_score:  Mapped[float]           = mapped_column(Float, default=0.8)

    # Meta
    action:            Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    ip_address:        Mapped[Optional[str]]  = mapped_column(String(45),  nullable=True)
    details:           Mapped[Optional[dict]] = mapped_column(JSON,        nullable=True)
    source_log_ids:    Mapped[Optional[list]] = mapped_column(JSON,        nullable=True)
    is_active:         Mapped[bool]           = mapped_column(Boolean, default=True)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_count:     Mapped[int]            = mapped_column(Integer, default=0)
    created_at:        Mapped[datetime]       = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    alerts = relationship("Alert", back_populates="rule")

    @property
    def time_window(self) -> int:
        """Retourne la fenetre temporelle (priorite time_window_sec puis window_seconds)."""
        return self.time_window_sec or self.window_seconds or 60

    def __repr__(self):
        return f"<CorrelationRule {self.name} [{self.rule_type}] active={self.is_active}>"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    alert_id:       Mapped[Optional[str]]      = mapped_column(String(100), unique=True, nullable=True)
    rule_id:        Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("correlation_rules.id"), nullable=True
    )

    # Classification
    severity:       Mapped[str] = mapped_column(
        SAEnum(LogSeverity, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=LogSeverity.WARNING.value,
    )
    status:         Mapped[str] = mapped_column(
        SAEnum(AlertStatus, values_callable=lambda x: [e.value for e in x]),
        default=AlertStatus.NEW.value,
    )

    # Contenu
    title:          Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    description:    Mapped[Optional[str]]  = mapped_column(Text,        nullable=True)
    source_ip:      Mapped[Optional[str]]  = mapped_column(String(45),  nullable=True, index=True)
    target_host:    Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    username:       Mapped[Optional[str]]  = mapped_column(String(150), nullable=True, index=True)
    confidence:     Mapped[Optional[float]] = mapped_column(Float,       nullable=True)
    ueba_score:     Mapped[Optional[float]] = mapped_column(Float,       nullable=True)

    # MITRE
    mitre_tactic:   Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    mitre_technique:Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)

    # SOAR
    playbook_result:Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actions_taken:  Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    assigned_to:    Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=True
    )

        # Canaux de notification envoyes (rapport)
    notification_report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    triggered_at:   Mapped[datetime]           = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    created_at:     Mapped[datetime]           = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at:Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rule          = relationship("CorrelationRule", back_populates="alerts")
    assigned_user = relationship("CTSUser", back_populates="alerts", foreign_keys=[assigned_to])
    playbook_executions = relationship("PlaybookExecution", back_populates="alert")

    def __repr__(self):
        return f"<Alert {self.alert_id} [{self.severity}/{self.status}]>"