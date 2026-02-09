"""Pydantic schemas for customer request session API."""

from __future__ import annotations
from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
import re

from app.models.request_session import SessionStatus


class RequestSessionCreate(BaseModel):
    """Schema for creating a new request session (Step 1 start)."""
    
    user_agent: str | None = None
    ip_address: str | None = None
    referrer: str | None = None
    utm_params: dict | None = None


class LocationValidation(BaseModel):
    """Schema for Step 1 - Personal info and location validation."""

    customer_name: str = Field(..., min_length=2, max_length=255)
    customer_phone: str = Field(..., min_length=10, max_length=20)
    customer_email: str | None = Field(None, max_length=255)
    address: str | None = Field(None, max_length=500)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    location_method: Literal["address", "pin"] = Field(default="address")

    @field_validator("customer_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Normalize phone number format."""
        digits = re.sub(r"\D", "", v)
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
        elif len(digits) >= 10:
            return f"+{digits}"
        raise ValueError("Invalid phone number format")

    @model_validator(mode="after")
    def validate_location(self) -> "LocationValidation":
        """Require either address or coordinates."""
        if self.location_method == "pin":
            if self.latitude is None or self.longitude is None:
                raise ValueError("Latitude and longitude are required when using pin location")
        else:
            if not self.address or len(self.address.strip()) < 10:
                raise ValueError("Address is required and must be at least 10 characters")
        return self


class LocationValidationResponse(BaseModel):
    """Response for location validation."""

    session_id: UUID
    is_in_service_area: bool
    city: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    message: str | None = None


class ServiceSelection(BaseModel):
    """Schema for Step 2 - Service selection."""

    service_type: str = Field(..., pattern="^(home_lockout|car_lockout|rekey|smart_lock)$")
    urgency: str = Field("standard", pattern="^(emergency|standard)$")
    description: str | None = Field(None, max_length=1000)

    # Car details (optional for car_lockout)
    car_make: str | None = Field(None, max_length=100)
    car_model: str | None = Field(None, max_length=100)
    car_year: int | None = Field(None, ge=1900, le=2100)


class ServiceSelectionResponse(BaseModel):
    """Response for service selection."""
    
    session_id: UUID
    deposit_amount: int
    deposit_display: str  # e.g., "$49.00"
    service_type: str
    urgency: str


class PaymentIntent(BaseModel):
    """Response with Stripe PaymentIntent for Step 3."""
    
    session_id: UUID
    client_secret: str
    payment_intent_id: str
    amount: int
    amount_display: str


class RequestSessionUpdate(BaseModel):
    """Schema for updating session data."""
    
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    address: str | None = None
    service_type: str | None = None
    urgency: str | None = None
    description: str | None = None


class RequestSessionResponse(BaseModel):
    """Schema for request session API response."""
    
    id: UUID
    status: SessionStatus
    step_reached: int
    
    # Customer info
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    
    # Location
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_in_service_area: bool | None = None
    
    # Service
    service_type: str | None = None
    urgency: str | None = None
    description: str | None = None
    deposit_amount: int | None = None
    
    # Car details (for car_lockout)
    car_make: str | None = None
    car_model: str | None = None
    car_year: int | None = None
    
    # Tracking
    user_agent: str | None = None
    ip_address: str | None = None
    referrer: str | None = None
    utm_params: dict | None = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    
    # Associated job (if payment completed)
    job_id: UUID | None = None

    class Config:
        from_attributes = True


class RequestSessionListResponse(BaseModel):
    """Paginated list of request sessions."""
    
    items: list[RequestSessionResponse]
    total: int
    page: int
    page_size: int
    pages: int
