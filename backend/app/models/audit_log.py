"""Modèle AuditLog — traçabilité de toutes les actions utilisateurs."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cts_users.id", ondelete="SET NULL"), nullable=True
    )
    action:        Mapped[str]           = mapped_column(String(64), nullable=False, index=True)
    target_entity: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    ip_address:    Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    result:        Mapped[str]           = mapped_column(String(32), default="success")
    detail:        Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship("CTSUser", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.action} by {self.user_id}>"