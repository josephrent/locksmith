"""Pydantic schemas for Message API."""

from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.models.message import MessageDirection


class MessageResponse(BaseModel):
    """Schema for message API response."""
    
    id: UUID
    job_id: UUID | None = None
    locksmith_id: UUID | None = None
    
    direction: MessageDirection
    to_phone: str
    from_phone: str
    body: str
    
    provider_message_id: str | None = None
    delivery_status: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    
    created_at: datetime
    
    # Enriched fields for admin view
    locksmith_name: str | None = None
    job_service_type: str | None = None

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """Paginated list of messages."""
    
    items: list[MessageResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TwilioWebhook(BaseModel):
    """Schema for incoming Twilio webhook."""
    
    MessageSid: str
    From: str
    To: str
    Body: str
    AccountSid: str | None = None
    NumMedia: str | None = None
    
    class Config:
        extra = "allow"  # Twilio sends many fields
