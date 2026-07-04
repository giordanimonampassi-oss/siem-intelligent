"""Schemas Pydantic — UEBA (Module 4)."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class UEBAProfileResponse(BaseModel):
    entity_id:       str
    entity_type:     str = "user"
    risk_score:      float
    avg_data_volume: float = 0.0
    typical_hours:   dict = {}


class UEBAProfileListResponse(BaseModel):
    total:   int
    results: List[UEBAProfileResponse]


class AnomalyResponse(BaseModel):
    id:           uuid.UUID
    anomaly_type: str
    description:  Optional[str]
    score_delta:  float
    detected_at:  datetime
    model_config = {"from_attributes": True}


class AnomalyListResponse(BaseModel):
    total:   int
    results: List[AnomalyResponse]


class ScoreHistoryPoint(BaseModel):
    date:  datetime
    score: float


class ScoreHistoryResponse(BaseModel):
    entity_id: str
    history:   List[ScoreHistoryPoint]