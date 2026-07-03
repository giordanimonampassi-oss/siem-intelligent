"""Schemas Pydantic — Alertes, Regles, SOAR (Module 3)."""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from core.constants import LogSeverity, AlertStatus, RuleType, PlaybookMode, AlertSeverity


# ─── Alertes ─────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id:              uuid.UUID
    alert_id:        Optional[str]
    severity:        str
    status:          str
    title:           Optional[str]
    description:     Optional[str]
    source_ip:       Optional[str]
    target_host:     Optional[str]
    username:        Optional[str]
    confidence:      Optional[float]
    ueba_score:      Optional[float]
    mitre_tactic:    Optional[str]
    mitre_technique: Optional[str]
    notification_report: Optional[dict] = None
    triggered_at:    datetime
    resolved_at:     Optional[datetime]
    acknowledged_at: Optional[datetime]
    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    total:   int
    page:    int
    size:    int
    results: List[AlertResponse]


class AlertUpdateStatus(BaseModel):
    status: str = Field(..., description="NEW | ACKNOWLEDGED | RESOLVED")


class AlertStatsResponse(BaseModel):
    total:          int
    by_severity:    Dict[str, int]
    by_status:      Dict[str, int]
    top_source_ips: List[Dict[str, Any]]


# ─── Regles de correlation ────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name:              str            = Field(..., min_length=3, max_length=255)
    description:       Optional[str]  = None
    rule_type:         RuleType       = RuleType.THRESHOLD
    mitre_tactic:      Optional[str]  = None
    mitre_technique:   Optional[str]  = None
    log_type_filter:   Optional[str]  = None
    event_field:       Optional[str]  = "source_ip"
    target_keyword:    Optional[str]  = None
    threshold:         Optional[int]  = Field(None, ge=1, le=1000)
    time_window_sec:   Optional[int]  = Field(None, ge=5, le=86400)
    cooldown_minutes:  Optional[int]  = Field(None, ge=0)
    pattern_sequence:  Optional[str]  = None
    alert_level:       AlertSeverity    = AlertSeverity.WARNING
    confidence_score:  float          = Field(0.8, ge=0.0, le=1.0)
    is_active:         bool           = True


class RuleUpdate(BaseModel):
    name:             Optional[str]       = None
    description:      Optional[str]       = None
    threshold:        Optional[int]       = None
    time_window_sec:  Optional[int]       = None
    target_keyword:   Optional[str]       = None
    alert_level:      Optional[AlertSeverity] = None
    confidence_score: Optional[float]     = None
    is_active:        Optional[bool]      = None


class RuleResponse(BaseModel):
    id:               uuid.UUID
    name:             str
    description:      Optional[str]
    rule_type:        str
    mitre_tactic:     Optional[str]
    mitre_technique:  Optional[str]
    log_type_filter:  Optional[str]
    event_field:      Optional[str]
    target_keyword:   Optional[str]
    threshold:        Optional[int]
    time_window_sec:  Optional[int]
    alert_level:      str
    confidence_score: float
    is_active:        bool
    trigger_count:    int
    last_triggered_at:Optional[datetime]
    created_at:       datetime
    model_config = {"from_attributes": True}


# ─── SOAR / Playbooks ────────────────────────────────────────────────────────

class PlaybookExecutionResponse(BaseModel):
    id:               uuid.UUID
    playbook:         Optional[str]
    mode:             str
    target:           Optional[str]
    status:           str
    detail:           Optional[str]
    confirm_deadline: Optional[datetime]
    executed_at:      Optional[datetime]
    created_at:       datetime
    model_config = {"from_attributes": True}

# ── Configuration des notifications (settings runtime) ───────────────────────
 
class NotificationConfigResponse(BaseModel):
    smtp_configured:    bool
    webhook_configured: bool
    sms_configured:     bool
    smtp_user:          Optional[str] = None   # masque partiellement
    alert_recipients:   List[str]     = []
    webhook_url_set:    bool
 
 
class NotificationTestRequest(BaseModel):
    channel: str = Field(..., description="email | webhook | sms | all")