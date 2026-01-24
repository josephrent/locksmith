"""JobOffer model tracking dispatch offers to locksmiths."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OfferStatus(str, Enum):
    """Job offer states."""
    
    PENDING = "pending"       # SMS sent, awaiting response
    ACCEPTED = "accepted"     # Locksmith said YES with quote
    DECLINED = "declined"     # Locksmith said NO
    EXPIRED = "expired"       # No response within window
    CANCELED = "canceled"     # Offer withdrawn (job assigned to someone else)


class JobOffer(Base):
    """
    JobOffer tracks an offer sent to a specific locksmith for a job.
    
    Multiple offers can exist per job (wave-based dispatch).
    Only one can be accepted.
    """
    
    __tablename__ = "job_offers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # References (job_id is nullable to support offers before job creation)
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,
        index=True,
    )
    request_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("request_sessions.id"),
        nullable=True,
        index=True,
    )
    locksmith_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locksmiths.id"),
        nullable=False,
        index=True,
    )
    
    # Quote/Price (in cents, set when locksmith responds with Y [Price])
    quoted_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Wave tracking
    wave_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    
    # Status
    status: Mapped[OfferStatus] = mapped_column(
        String(50),
        default=OfferStatus.PENDING,
        nullable=False,
        index=True,
    )
    
    # Twilio message tracking
    twilio_message_sid: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    job = relationship("Job", back_populates="job_offers")
    request_session = relationship("RequestSession", back_populates="job_offers")
    locksmith = relationship("Locksmith", back_populates="job_offers")

    def __repr__(self) -> str:
        return f"<JobOffer {self.id} - Wave {self.wave_number} ({self.status})>"
