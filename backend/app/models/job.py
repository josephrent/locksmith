"""Job model representing customer service requests."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobStatus(str, Enum):
    """Job lifecycle states."""
    
    CREATED = "created"           # Deposit captured, awaiting dispatch
    DISPATCHING = "dispatching"   # Sending offers to locksmiths
    OFFERED = "offered"           # Offers sent, awaiting response
    ASSIGNED = "assigned"         # Locksmith accepted
    EN_ROUTE = "en_route"         # Locksmith on the way
    COMPLETED = "completed"       # Job finished successfully
    CANCELED = "canceled"         # Job canceled (by admin or customer)
    FAILED = "failed"             # No locksmith accepted / dispatch failed


class Job(Base):
    """
    Job represents a customer service request.
    
    Jobs are created after deposit is captured and go through
    the dispatch workflow until completion or failure.
    """
    
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Customer info (no auth, identified by phone)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    
    # Service details
    service_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    urgency: Mapped[str] = mapped_column(String(50), default="standard")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Location
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    
    # Status
    status: Mapped[JobStatus] = mapped_column(
        String(50),
        default=JobStatus.CREATED,
        nullable=False,
        index=True,
    )
    
    # Payment
    deposit_amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in cents
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_payment_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    refund_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stripe_refund_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Assignment
    assigned_locksmith_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locksmiths.id"),
        nullable=True,
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Dispatch tracking
    current_wave: Mapped[int] = mapped_column(Integer, default=0)
    dispatch_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Request session reference
    request_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("request_sessions.id"),
        nullable=True,
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    assigned_locksmith = relationship("Locksmith", back_populates="jobs")
    job_offers = relationship("JobOffer", back_populates="job", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="job", cascade="all, delete-orphan")
    request_session = relationship("RequestSession", back_populates="job")

    def __repr__(self) -> str:
        return f"<Job {self.id} - {self.service_type} ({self.status})>"
