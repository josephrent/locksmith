"""Locksmith model for service providers."""

import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Locksmith(Base):
    """
    Locksmith represents a service provider in the marketplace.
    
    Locksmiths are manually onboarded by admins and interact
    exclusively via SMS in MVP.
    """
    
    __tablename__ = "locksmiths"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Identity
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    
    # Location
    primary_city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # Service capabilities
    supports_home_lockout: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_car_lockout: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_rekey: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_smart_lock: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Availability
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    typical_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Admin notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    onboarded_at: Mapped[datetime] = mapped_column(
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

    # Relationships
    jobs = relationship("Job", back_populates="assigned_locksmith")
    job_offers = relationship("JobOffer", back_populates="locksmith")

    def supports_service(self, service_type: str) -> bool:
        """Check if locksmith supports a given service type."""
        service_map = {
            "home_lockout": self.supports_home_lockout,
            "car_lockout": self.supports_car_lockout,
            "rekey": self.supports_rekey,
            "smart_lock": self.supports_smart_lock,
        }
        return service_map.get(service_type, False)

    def __repr__(self) -> str:
        return f"<Locksmith {self.display_name} ({self.phone})>"
