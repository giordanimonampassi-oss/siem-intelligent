"""Schemas Pydantic — Rapports & Archivage (Module 5)."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ReportGenerateRequest(BaseModel):
    type:      str = Field(..., description="security | compliance | incident | audit")
    period:    str = Field(..., description="daily | weekly | monthly | custom")
    date_from: Optional[datetime] = None
    date_to:   Optional[datetime] = None


class ReportResponse(BaseModel):
    id:           uuid.UUID
    type:         str
    period:       str
    date_from:    Optional[datetime]
    date_to:      Optional[datetime]
    total_logs:   int
    total_alerts: int
    top_threat:   Optional[str]
    generated_at: datetime
    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    total:   int
    results: List[ReportResponse]


class IntegrityBatchResponse(BaseModel):
    id:           uuid.UUID
    period_start: datetime
    period_end:   Optional[datetime]
    log_count:    int
    sha256_hash:  str
    verified:     bool
    model_config = {"from_attributes": True}


class IntegrityBatchListResponse(BaseModel):
    total:   int
    results: List[IntegrityBatchResponse]