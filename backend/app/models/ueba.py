"""Modele UEBA — UserBehaviorProfile."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class UserBehaviorProfile(Base):
    __tablename__ = "user_behavior_profiles"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=False, unique=True
    )
    metric:   Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mean:     Mapped[float]         = mapped_column(Float, default=0.0)
    std_dev:  Mapped[float]         = mapped_column(Float, default=0.0)
    ntrps:    Mapped[int]           = mapped_column(Integer, default=0)

    # Baseline comportementale (Module 4)
    avg_login_hour:        Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_daily_volume_mb:   Mapped[Optional[float]]  = mapped_column(Float, nullable=True)
    avg_session_duration_h:Mapped[Optional[float]]  = mapped_column(Float, nullable=True)
    usual_hosts:           Mapped[Optional[str]]    = mapped_column(String(1024), nullable=True)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    compute_anomaly_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_anomaly_value:      Mapped[bool]             = mapped_column(Boolean, default=False)

    user = relationship("CTSUser", back_populates="behavior_profiles")
    anomalies = relationship("UEBAAnomaly", back_populates="profile")

    def __repr__(self):
        return f"<UserBehaviorProfile user={self.user_id}>"
    

class UEBAAnomaly(Base):
    __tablename__ = "ueba_anomalies"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_behavior_profiles.id"), nullable=False
    )
    anomaly_type: Mapped[str] = mapped_column(String(32), nullable=False)  # time_anomaly | volume_anomaly | resource_anomaly
    description:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score_delta:  Mapped[float] = mapped_column(Float, default=0.0)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    profile = relationship("UserBehaviorProfile", back_populates="anomalies")

    def __repr__(self):
        return f"<UEBAAnomaly {self.anomaly_type} +{self.score_delta}>"