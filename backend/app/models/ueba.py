"""Modèle UEBA — profil comportemental utilisateur."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class UserBehaviorProfile(Base):
    __tablename__ = "user_behavior_profiles"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=False, unique=True
    )
    metric:                Mapped[Optional[str]]   = mapped_column(String(100), nullable=True)
    mean:                  Mapped[float]           = mapped_column(Float, default=0.0)
    std_dev:               Mapped[float]           = mapped_column(Float, default=0.0)
    ntrps:                 Mapped[int]             = mapped_column(Integer, default=0)
    last_updated:          Mapped[datetime]        = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    compute_anomaly_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_anomaly_value:      Mapped[bool]            = mapped_column(Boolean, default=False)

    user = relationship("CTSUser", back_populates="behavior_profiles")

    def __repr__(self):
        return f"<UserBehaviorProfile user={self.user_id}>"