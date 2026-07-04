"""Modeles Report et ReportIntegrityBatch — Module 5 (Reporting & Archivage)."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type:   Mapped[str] = mapped_column(String(32), nullable=False)   # security | compliance | incident | audit
    period: Mapped[str] = mapped_column(String(16), nullable=False)   # daily | weekly | monthly | custom
    date_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    date_to:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    total_logs:   Mapped[int]            = mapped_column(Integer, default=0)
    total_alerts: Mapped[int]            = mapped_column(Integer, default=0)
    top_threat:   Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    summary:      Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    generated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id"), nullable=True
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<Report {self.type}/{self.period} @ {self.generated_at}>"


class ReportIntegrityBatch(Base):
    """Hash SHA-256 par lot de logs — valeur probatoire (chain of custody)."""
    __tablename__ = "report_integrity_batches"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start: Mapped[datetime]           = mapped_column(DateTime(timezone=True), nullable=False)
    period_end:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    log_count:    Mapped[int]  = mapped_column(Integer, default=0)
    sha256_hash:  Mapped[str]  = mapped_column(String(64), nullable=False)
    verified:     Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<IntegrityBatch {self.period_start} count={self.log_count} verified={self.verified}>"