"""Modèles Infrastructure — nœuds surveillés et agrégats de logs."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class InfrastructureNode(Base):
    """Nœud d'infrastructure CTU surveillé par le SIEM."""
    __tablename__ = "infrastructure_nodes"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host:         Mapped[str]           = mapped_column(String(255), nullable=False, unique=True)
    is_available: Mapped[bool]          = mapped_column(Boolean, default=True)
    is_enabled:   Mapped[bool]          = mapped_column(Boolean, default=True)
    index_prefix: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at:   Mapped[datetime]      = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    log_entries = relationship("LogEntry", back_populates="node")

    def __repr__(self):
        return f"<InfrastructureNode {self.host}>"


class LogAggregate(Base):
    """
    Métadonnées d'agrégats de logs.
    Le contenu brut reste dans Elasticsearch —
    PostgreSQL garde les métadonnées et le hash SHA-256 pour l'intégrité.
    """
    __tablename__ = "log_aggregates"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end:   Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    log_count:    Mapped[int]      = mapped_column(Integer, default=0)
    sha256_hash:  Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    batch_id:     Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    archived_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified:    Mapped[bool]               = mapped_column(Boolean, default=False)

    def __repr__(self):
        return f"<LogAggregate {self.period_start} → {self.period_end} ({self.log_count} logs)>"