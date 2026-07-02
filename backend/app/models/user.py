"""Modele CTSUser."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
from core.constants import UserRole


class CTSUser(Base):
    __tablename__ = "cts_users"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    email:    Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    totp_secret: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    role: Mapped[str] = mapped_column(
        SAEnum(UserRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=UserRole.READER.value,
    )
    team_scope: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    perimeter:  Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_active:  Mapped[bool] = mapped_column(Boolean, default=True)

    risk_score:       Mapped[float] = mapped_column(Float, default=0.0)
    last_risk_update: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    alerts = relationship("Alert", back_populates="assigned_user", foreign_keys="Alert.assigned_to")
    behavior_profiles = relationship("UserBehaviorProfile", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

    def get_perimeter(self) -> list:
        return [p.strip() for p in self.perimeter.split(",")] if self.perimeter else []

    def __repr__(self):
        return f"<CTSUser {self.username} [{self.role}]>"