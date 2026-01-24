"""Message model for SMS audit trail."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MessageDirection(str, Enum):
    """SMS message direction."""
    
    OUTBOUND = "outbound"  # Sent by system
    INBOUND = "inbound"    # Received from locksmith


class Message(Base):
    """
    Message tracks all SMS communications for audit purposes.
    
    Every SMS sent or received is logged here for:
    - Dispute resolution
    - Debugging delivery issues
    - Compliance
    """
    
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Job association (nullable for system messages)
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,
        index=True,
    )
    
    # Locksmith association
    locksmith_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locksmiths.id"),
        nullable=True,
        index=True,
    )
    
    # Message details
    direction: Mapped[MessageDirection] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    to_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    from_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Twilio metadata
    provider_message_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    delivery_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    job = relationship("Job", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message {self.direction} {self.id[:8]}...>"
