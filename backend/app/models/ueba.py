"""Modeles UEBA — profils comportementaux (utilisateurs ET machines),
anomalies detectees, et snapshots de score pour l'historique reel."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean, DateTime, Float, Integer, String, Text,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
from core.constants import EntityType


class UserBehaviorProfile(Base):
    """
    Profil comportemental d'une entite : utilisateur (CTSUser) OU machine
    (InfrastructureNode). Un seul des deux FK est renseigne selon entity_type ;
    entity_label est l'identifiant stable utilise par l'API (username ou hostname).
    """
    __tablename__ = "user_behavior_profiles"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    entity_type:  Mapped[str] = mapped_column(String(16), nullable=False, default=EntityType.USER.value, index=True)
    entity_label: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=True, unique=True
    )
    node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("infrastructure_nodes.id"), nullable=True, unique=True
    )

    # Deplace depuis CTSUser.risk_score pour couvrir aussi les machines
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)

    metric:   Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mean:     Mapped[float]         = mapped_column(Float, default=0.0)
    std_dev:  Mapped[float]         = mapped_column(Float, default=0.0)
    ntrps:    Mapped[int]           = mapped_column(Integer, default=0)

    avg_login_hour:         Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_daily_volume_mb:    Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_session_duration_h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usual_hosts:            Mapped[Optional[str]]   = mapped_column(String(1024), nullable=True)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    compute_anomaly_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_anomaly_value:      Mapped[bool]             = mapped_column(Boolean, default=False)

    user = relationship("CTSUser", back_populates="behavior_profiles", foreign_keys=[user_id])
    node = relationship("InfrastructureNode", foreign_keys=[node_id])  # ajuste le nom de classe si différent
    anomalies = relationship("UEBAAnomaly", back_populates="profile", cascade="all, delete-orphan")
    snapshots = relationship(
        "UEBAScoreSnapshot", back_populates="profile",
        cascade="all, delete-orphan", order_by="UEBAScoreSnapshot.snapshot_date",
    )

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_label", name="uq_profile_entity"),
    )

    def __repr__(self):
        return f"<UserBehaviorProfile {self.entity_type}:{self.entity_label} risk={self.risk_score}>"


class UEBAAnomaly(Base):
    __tablename__ = "ueba_anomalies"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_behavior_profiles.id"), nullable=False, index=True
    )
    anomaly_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score_delta:  Mapped[float] = mapped_column(Float, default=0.0)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    profile = relationship("UserBehaviorProfile", back_populates="anomalies")


class UEBAScoreSnapshot(Base):
    """Photo quotidienne du risk_score — alimente l'historique reel du chart."""
    __tablename__ = "ueba_score_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_behavior_profiles.id"), nullable=False, index=True
    )
    snapshot_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    risk_score:    Mapped[float]    = mapped_column(Float, nullable=False)

    profile = relationship("UserBehaviorProfile", back_populates="snapshots")

    __table_args__ = (
        UniqueConstraint("profile_id", "snapshot_date", name="uq_snapshot_profile_date"),
    )