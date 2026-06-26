"""
Smart SIEM – Modèles SQLAlchemy (PostgreSQL uniquement)
Généré depuis le diagramme de classes hybride CTU/MITRE ATT&CK.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer,
    String, Text, Enum as SAEnum, JSON, ARRAY, func
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, relationship
import uuid
import enum


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class AuthNetwork(str, enum.Enum):
    AUTH = "AUTH"
    NETWORK = "NETWORK"
    APPLICATION = "APPLICATION"
    SYSTEM = "SYSTEM"
    CLOUD = "CLOUD"


class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    HIGH_RESOLVED = "HIGH_RESOLVED"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    INTER_SOURCE = "INTER_SOURCE"
    RESOLVED = "RESOLVED"


class UserRole(str, enum.Enum):
    READER = "READER"
    ANALYST = "ANALYST"
    AUDITOR = "AUDITOR"
    RSS = "RSS"


class PlaybookMode(str, enum.Enum):
    MANUAL = "MANUAL"
    AUTO = "AUTO"
    SEMI_AUTO = "SEMI_AUTO"


class RuleType(str, enum.Enum):
    THRESHOLD = "THRESHOLD"
    SEQUENCE = "SEQUENCE"
    AGGREGATION = "AGGREGATION"
    ANOMALY = "ANOMALY"


# ---------------------------------------------------------------------------
# Entités de Gestion (PostgreSQL)
# ---------------------------------------------------------------------------

class CTSUser(Base):
    """Utilisateur CTU avec RBAC."""
    __tablename__ = "cts_users"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    totp_secret = Column(String(64))
    email = Column(String(255), nullable=False, unique=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.READER)
    team_scope = Column(String(100))
    is_active = Column(Boolean, default=True)
    risk_score = Column(Float, default=0.0)
    last_risk_update = Column(DateTime, default=func.now())

    # Relationships
    alerts = relationship("Alert", back_populates="assigned_user", foreign_keys="Alert.assigned_to")
    behavior_profiles = relationship("UserBehaviorProfile", back_populates="user")

    def __repr__(self):
        return f"<CTSUser {self.username} [{self.role}]>"


# ---------------------------------------------------------------------------
# Règles de Corrélation MITRE ATT&CK
# ---------------------------------------------------------------------------

class CorrelationRule(Base):
    __tablename__ = "correlation_rules"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    rule_type = Column(SAEnum(RuleType), nullable=False)
    mitre_tactic = Column(String(100))
    mitre_technique = Column(String(100))
    action = Column(String(100))
    target_keyword = Column(String(255))
    threshold = Column(Integer)
    window_seconds = Column(Integer)
    cooldown_minutes = Column(Integer)
    ip_address = Column(String(45))
    timestamp = Column(DateTime, default=func.now())
    details = Column(JSON)
    is_active = Column(Boolean, default=True)
    source_log_ids = Column(JSON)  # List[keyword]

    alerts = relationship("Alert", back_populates="rule")

    def __repr__(self):
        return f"<CorrelationRule {self.name} [{self.rule_type}]>"


# ---------------------------------------------------------------------------
# Alertes
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(String(100), unique=True)
    rule_id = Column(PGUUID(as_uuid=True), ForeignKey("correlation_rules.id"), nullable=True)
    severity = Column(SAEnum(AlertSeverity), nullable=False)
    status = Column(SAEnum(AlertStatus), default=AlertStatus.NEW)
    assigned_to = Column(PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())
    resolved_at = Column(DateTime)
    playbook_result = Column(JSON)
    actions_taken = Column(JSON)

    rule = relationship("CorrelationRule", back_populates="alerts")
    assigned_user = relationship("CTSUser", back_populates="alerts", foreign_keys=[assigned_to])
    playbook_executions = relationship("PlaybookExecution", back_populates="alert")

    def __repr__(self):
        return f"<Alert {self.alert_id} [{self.severity}/{self.status}]>"


# ---------------------------------------------------------------------------
# Playbooks SOAR
# ---------------------------------------------------------------------------

class Playbook(Base):
    __tablename__ = "playbooks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    mode = Column(SAEnum(PlaybookMode), default=PlaybookMode.MANUAL)
    max_delay_sec = Column(Integer, default=0)
    severity_filter = Column(SAEnum(AlertSeverity))
    actions = Column(JSON)  # List of action definitions
    channels = Column(JSON)  # List[String] notification channels

    executions = relationship("PlaybookExecution", back_populates="playbook")

    def __repr__(self):
        return f"<Playbook {self.name} [{self.mode}]>"


class PlaybookExecution(Base):
    __tablename__ = "playbook_executions"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playbook_id = Column(PGUUID(as_uuid=True), ForeignKey("playbooks.id"), nullable=False)
    alert_id = Column(PGUUID(as_uuid=True), ForeignKey("alerts.id"), nullable=False)
    executed_at = Column(DateTime, default=func.now())
    result = Column(JSON)
    success = Column(Boolean, default=False)
    firewall_cmd = Column(String(500))
    log_output = Column(Text)

    playbook = relationship("Playbook", back_populates="executions")
    alert = relationship("Alert", back_populates="playbook_executions")

    def __repr__(self):
        return f"<PlaybookExecution playbook={self.playbook_id} alert={self.alert_id}>"


# ---------------------------------------------------------------------------
# Profils comportementaux utilisateurs (UEBA)
# ---------------------------------------------------------------------------

class UserBehaviorProfile(Base):
    """Profil comportemental pour le scoring UEBA (lié à CTSUser)."""
    __tablename__ = "user_behavior_profiles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=False, unique=True)
    metric = Column(String(100))
    mean = Column(Float, default=0.0)
    std_dev = Column(Float, default=0.0)
    ntrps = Column(Integer, default=0)
    last_updated = Column(DateTime, default=func.now())
    compute_anomaly_value = Column(Float)
    is_anomaly_value = Column(Boolean, default=False)

    user = relationship("CTSUser", back_populates="behavior_profiles")

    def __repr__(self):
        return f"<UserBehaviorProfile user={self.user_id}>"


# ---------------------------------------------------------------------------
# Agrégats de logs archivés (Elasticsearch → PostgreSQL metadata)
# ---------------------------------------------------------------------------

class LogAggregate(Base):
    """Métadonnées d'agrégats de logs (le contenu brut reste dans Elasticsearch)."""
    __tablename__ = "log_aggregates"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    log_count = Column(Integer, default=0)
    sha256_hash = Column(String(64))
    archived_at = Column(DateTime, default=func.now())
    verified_at = Column(DateTime)
    verified = Column(Boolean, default=False)

    def __repr__(self):
        return f"<LogAggregate {self.period_start} → {self.period_end}>"


# ---------------------------------------------------------------------------
# Infrastructure surveillée
# ---------------------------------------------------------------------------

class InfrastructureNode(Base):
    """Nœud d'infrastructure CTU surveillé par le SIEM."""
    __tablename__ = "infrastructure_nodes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host = Column(String(255), nullable=False)
    is_available = Column(Boolean, default=True)
    index_prefix = Column(String(100))
    is_enabled = Column(Boolean, default=True)

    def __repr__(self):
        return f"<InfrastructureNode {self.host}>"
