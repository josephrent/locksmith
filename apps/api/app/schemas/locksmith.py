"""Pydantic schemas for Locksmith API."""

from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
import re


class LocksmithBase(BaseModel):
    """Base schema for locksmith data."""
    
    display_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    primary_city: str = Field(..., min_length=2, max_length=100)
    
    supports_home_lockout: bool = False
    supports_car_lockout: bool = False
    supports_rekey: bool = False
    supports_smart_lock: bool = False
    
    typical_hours: str | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Normalize phone number format."""
        # Remove all non-digit characters
        digits = re.sub(r"\D", "", v)
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
        elif len(digits) >= 10:
            return f"+{digits}"
        raise ValueError("Invalid phone number format")


class LocksmithCreate(LocksmithBase):
    """Schema for creating a new locksmith."""
    
    is_active: bool = True
    is_available: bool = True


class LocksmithUpdate(BaseModel):
    """Schema for updating a locksmith (all fields optional)."""
    
    display_name: str | None = Field(None, min_length=2, max_length=255)
    phone: str | None = Field(None, min_length=10, max_length=20)
    primary_city: str | None = Field(None, min_length=2, max_length=100)
    
    supports_home_lockout: bool | None = None
    supports_car_lockout: bool | None = None
    supports_rekey: bool | None = None
    supports_smart_lock: bool | None = None
    
    is_active: bool | None = None
    is_available: bool | None = None
    typical_hours: str | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        """Normalize phone number format."""
        if v is None:
            return v
        digits = re.sub(r"\D", "", v)
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
        elif len(digits) >= 10:
            return f"+{digits}"
        raise ValueError("Invalid phone number format")


class LocksmithStats(BaseModel):
    """Locksmith performance statistics."""
    
    total_jobs: int = 0
    completed_jobs: int = 0
    acceptance_rate: float = 0.0
    avg_response_time_seconds: float | None = None


class LocksmithResponse(LocksmithBase):
    """Schema for locksmith API response."""
    
    id: UUID
    is_active: bool
    is_available: bool
    onboarded_at: datetime
    updated_at: datetime
    stats: LocksmithStats | None = None

    class Config:
        from_attributes = True


class LocksmithListResponse(BaseModel):
    """Paginated list of locksmiths."""
    
    items: list[LocksmithResponse]
    total: int
    page: int
    page_size: int
    pages: int
