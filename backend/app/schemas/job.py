"""Pydantic schemas for Job API."""

from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.job import JobStatus


class JobOfferResponse(BaseModel):
    """Schema for job offer in responses."""
    
    id: UUID
    locksmith_id: UUID
    locksmith_name: str | None = None
    locksmith_phone: str | None = None
    wave_number: int
    status: str
    sent_at: datetime
    responded_at: datetime | None = None

    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    """Schema for job API response."""
    
    id: UUID
    
    # Customer info
    customer_name: str
    customer_phone: str
    
    # Service details
    service_type: str
    urgency: str
    description: str | None = None
    
    # Location
    address: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
    
    # Status
    status: JobStatus
    
    # Payment
    deposit_amount: int
    stripe_payment_intent_id: str | None = None
    stripe_payment_status: str | None = None
    refund_amount: int | None = None
    
    # Assignment
    assigned_locksmith_id: UUID | None = None
    assigned_locksmith_name: str | None = None
    assigned_at: datetime | None = None
    
    # Dispatch
    current_wave: int
    dispatch_started_at: datetime | None = None
    
    # Offers (populated in detail view)
    offers: list[JobOfferResponse] | None = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Paginated list of jobs."""
    
    items: list[JobResponse]
    total: int
    page: int
    page_size: int
    pages: int


class JobStatusUpdate(BaseModel):
    """Schema for updating job status."""
    
    status: JobStatus
    reason: str | None = None


class JobAssignment(BaseModel):
    """Schema for manually assigning a locksmith to a job."""
    
    locksmith_id: UUID
    notify_locksmith: bool = True
    reason: str | None = None


class JobRefund(BaseModel):
    """Schema for triggering a refund."""
    
    amount: int | None = Field(None, description="Amount in cents. If null, refund full deposit.")
    reason: str = Field(..., min_length=5, max_length=500)


class DispatchControl(BaseModel):
    """Schema for dispatch control actions."""
    
    action: str = Field(..., pattern="^(restart|next_wave|cancel)$")
    reason: str | None = None
