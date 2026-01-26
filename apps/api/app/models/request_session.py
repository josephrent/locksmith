"""RequestSession model for tracking customer flow before payment."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(str, Enum):
    """Request session states."""
    
    STARTED = "started"               # Initial form started
    LOCATION_VALIDATED = "location_validated"  # Address in service area
    LOCATION_REJECTED = "location_rejected"    # Address not in service area
    SERVICE_SELECTED = "service_selected"      # Service type chosen
    PENDING_APPROVAL = "pending_approval"      # Waiting for locksmith quotes
    PAYMENT_PENDING = "payment_pending"        # Awaiting payment
    PAYMENT_COMPLETED = "payment_completed"    # Deposit captured, job created
    ABANDONED = "abandoned"                    # User left without completing


class RequestSession(Base):
    """
    RequestSession tracks customer progress through the booking funnel.
    
    Used for:
    - Abandoned cart analysis
    - Service area demand tracking
    - Debugging customer issues
    - Fraud detection
    """
    
    __tablename__ = "request_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Status
    status: Mapped[SessionStatus] = mapped_column(
        String(50),
        default=SessionStatus.STARTED,
        nullable=False,
        index=True,
    )
    
    # Customer info (collected in step 1)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Location (collected in step 1)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_in_service_area: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    
    # Service selection (collected in step 2)
    service_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    urgency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deposit_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in cents
    
    # Car details (for car_lockout service)
    car_make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    car_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    car_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Payment (step 3)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Tracking
    step_reached: Mapped[int] = mapped_column(Integer, default=1)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    utm_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
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
    job = relationship("Job", back_populates="request_session", uselist=False)
    job_offers = relationship("JobOffer", back_populates="request_session", cascade="all, delete-orphan")
    photos = relationship("Photo", back_populates="request_session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<RequestSession {self.id} - Step {self.step_reached} ({self.status})>"
