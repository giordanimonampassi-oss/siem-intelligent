"""Constantes et énumérations globales — Smart SIEM."""
from enum import Enum


class UserRole(str, Enum):
    ADMIN    = "admin"
    ANALYST  = "analyst"
    RSSI     = "rssi"
    AUDITOR  = "auditor"
    READER   = "reader"


class LogSeverity(str, Enum):
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"


class LogType(str, Enum):
    AUTH        = "auth"
    NETWORK     = "network"
    SYSTEM      = "system"
    APPLICATION = "application"
    CLOUD       = "cloud"

class RuleType(str, Enum):
    THRESHOLD   = "THRESHOLD"
    SEQUENCE    = "SEQUENCE"
    AGGREGATION = "AGGREGATION"
    ANOMALY     = "ANOMALY"

class AlertSeverity(str, Enum):
    INFO     = "INFO"
    WARNING  = "WARNING"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"

class AlertStatus(str, Enum):
    NEW          = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED     = "RESOLVED"

class PlaybookType(str, Enum):
    BLOCK_IP         = "block_ip"
    DISABLE_ACCOUNT  = "disable_account"
    ESCALATE         = "escalate"


class PlaybookMode(str, Enum):
    MANUAL  = "manual"
    AUTO    = "auto"
    CONFIRM = "confirm"


class PlaybookStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    CANCELLED = "cancelled"

class IncidentStatus(str, Enum):
    OPEN         = "OPEN"
    IN_PROGRESS  = "IN_PROGRESS"
    RESOLVED     = "RESOLVED"


# Seuil UEBA pour rehaussement d'alerte
UEBA_RISK_THRESHOLD_CORREL = 50

# Taille de batch pour l'ingestion en masse
LOG_BATCH_SIZE = 500

# Nom de l'index Elasticsearch
ES_INDEX_LOGS = "logs"