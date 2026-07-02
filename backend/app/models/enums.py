"""
Enumerations partagees pour le module de gestion des incidents.
"""
from enum import Enum


class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, Enum):
    OPEN = "ouvert"
    IN_PROGRESS = "en_cours"
    RESOLVED = "resolu"
    FALSE_POSITIVE = "faux_positif"


class EntityType(str, Enum):
    IP = "ip"
    USER = "utilisateur"
    HOST = "machine"
    ACCOUNT = "compte_service"


class ActionType(str, Enum):
    IP_BLOCKED = "ip_bloquee"
    ACCOUNT_DISABLED = "compte_desactive"
    HOST_ISOLATED = "machine_isolee"
    NOTIFICATION_SENT = "notification_envoyee"
    ESCALATION = "escalade"
    MANUAL_NOTE = "note_manuelle"


class ActionMode(str, Enum):
    AUTO = "auto"          # execution immediate (section 4.4)
    CONFIRM = "confirm"    # necessite validation humaine, delai 60s
    MANUAL = "manuel"      # declenchee a la main par un analyste


class ActionStatus(str, Enum):
    PENDING = "en_attente"
    EXECUTED = "executee"
    CANCELLED = "annulee"
    FAILED = "echouee"