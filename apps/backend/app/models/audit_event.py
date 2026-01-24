"""AuditEvent model for tracking all system changes."""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditEvent(Base):
    """
    AuditEvent records all significant system events for:
    - Admin action tracking
    - Debugging
    - Compliance
    - Dispute resolution
    """
    
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # What was affected
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # What happened
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # Who did it (email from Cloudflare Access header, if available)
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    actor_type: Mapped[str] = mapped_column(String(50), default="system")  # system, admin, locksmith
    
    # Event details
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<AuditEvent {self.event_type} on {self.entity_type}:{self.entity_id}>"
