"""
Modèle LogEntry — stockage PostgreSQL + indexation Elasticsearch.
Le contenu brut est dans ES, PostgreSQL garde la référence et les métadonnées.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
from core.constants import LogType, LogSeverity


class LogEntry(Base):
    __tablename__ = "log_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Horodatage de l'événement (pas de l'ingestion)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True,
        default=lambda: datetime.now(timezone.utc),
    )
    # Réseau
    source_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    dest_ip:   Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    # Contexte
    host:     Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)
    # Classification (AuthNetwork → LogType)
    log_type: Mapped[str] = mapped_column(
        SAEnum(LogType, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=LogType.SYSTEM.value, index=True,
    )
    severity: Mapped[str] = mapped_column(
        SAEnum(LogSeverity, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=LogSeverity.INFO.value, index=True,
    )
    # Contenu
    raw_message:  Mapped[str]           = mapped_column(Text, nullable=False)
    is_suspicious:Mapped[bool]          = mapped_column(Boolean, default=False)
    note:         Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Traçabilité
    batch_id:   Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    es_indexed: Mapped[bool]          = mapped_column(Boolean, default=False)
    # Lien vers le nœud d'infrastructure source
    node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("infrastructure_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    node = relationship("InfrastructureNode", back_populates="log_entries")

    def to_es_doc(self) -> dict:
        """Sérialise pour indexation Elasticsearch."""
        return {
            "id":           str(self.id),
            "timestamp":    self.timestamp.isoformat() if self.timestamp else None,
            "source_ip":    self.source_ip,
            "dest_ip":      self.dest_ip,
            "host":         self.host,
            "username":     self.username,
            "log_type":     self.log_type,
            "severity":     self.severity,
            "raw_message":  self.raw_message,
            "is_suspicious":self.is_suspicious,
            "batch_id":     self.batch_id,
            "node_id":      str(self.node_id) if self.node_id else None,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<LogEntry {self.id} [{self.severity}/{self.log_type}]>"