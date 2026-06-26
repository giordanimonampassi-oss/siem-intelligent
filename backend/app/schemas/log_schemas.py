"""Schémas Pydantic — Logs (Module 1 & 2)."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import ipaddress
from core.constants import LogSeverity, LogType


class LogIngest(BaseModel):
    """Payload d'ingestion d'un log — seul raw_message est obligatoire."""
    timestamp:   Optional[datetime]    = None
    source_ip:   Optional[str]         = None
    dest_ip:     Optional[str]         = None
    host:        Optional[str]         = Field(None, max_length=255)
    username:    Optional[str]         = Field(None, max_length=150)
    log_type:    Optional[LogType]     = None   # Auto-détecté si absent
    severity:    Optional[LogSeverity] = None   # Auto-détecté si absent
    raw_message: str                   = Field(..., min_length=1, max_length=4096)
    batch_id:    Optional[str]         = Field(None, max_length=64)
    node_id:     Optional[uuid.UUID]   = None   # Nœud infra source

    @field_validator("source_ip", "dest_ip", mode="before")
    @classmethod
    def validate_ip(cls, v):
        if v is None:
            return v
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            return None


class LogBatchIngest(BaseModel):
    logs:     List[LogIngest] = Field(..., min_length=1, max_length=500)
    batch_id: Optional[str]   = Field(None, max_length=64)


class LogResponse(BaseModel):
    log_id:    uuid.UUID
    timestamp: datetime
    severity:  LogSeverity
    log_type:  LogType
    batch_id:  Optional[str] = None
    es_indexed:bool = False
    model_config = {"from_attributes": True}


class LogDetail(BaseModel):
    id:           uuid.UUID
    timestamp:    datetime
    source_ip:    Optional[str]
    dest_ip:      Optional[str]
    host:         Optional[str]
    username:     Optional[str]
    log_type:     LogType
    severity:     LogSeverity
    raw_message:  str
    is_suspicious:bool
    note:         Optional[str]
    batch_id:     Optional[str]
    es_indexed:   bool
    created_at:   datetime
    model_config = {"from_attributes": True}


class LogSearchParams(BaseModel):
    source_ip: Optional[str]          = None
    dest_ip:   Optional[str]          = None
    username:  Optional[str]          = None
    host:      Optional[str]          = None
    log_type:  Optional[LogType]      = None
    severity:  Optional[LogSeverity]  = None
    from_dt:   Optional[datetime]     = None
    to_dt:     Optional[datetime]     = None
    keyword:   Optional[str]          = None
    page:      int = Field(1, ge=1)
    size:      int = Field(50, ge=1, le=500)


class LogSearchResult(BaseModel):
    total:   int
    page:    int
    size:    int
    results: List[LogDetail]


class LogMarkSuspicious(BaseModel):
    is_suspicious: bool
    note:          Optional[str] = Field(None, max_length=1024)


class BatchIntegrityResponse(BaseModel):
    batch_id:    str
    sha256:      str
    log_count:   int
    algorithm:   str = "SHA-256"
    verified:    bool = False