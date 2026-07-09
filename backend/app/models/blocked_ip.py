"""Modele BlockedIP — blocage applicatif des adresses IP (Module 3 SOAR)."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_address:   Mapped[str]            = mapped_column(String(45), nullable=False, unique=True, index=True)
    reason:       Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    blocked_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    unblocked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active:    Mapped[bool]           = mapped_column(Boolean, default=True)

    def __repr__(self):
        return f"<BlockedIP {self.ip_address} active={self.is_active}>"