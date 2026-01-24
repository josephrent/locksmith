"""Admin API routes for locksmith management."""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Query

from app.api.deps import LocksmithServiceDep, AuditServiceDep
from app.schemas.locksmith import (
    LocksmithCreate,
    LocksmithUpdate,
    LocksmithResponse,
    LocksmithListResponse,
)

router = APIRouter(prefix="/locksmiths", tags=["admin-locksmiths"])


@router.get("", response_model=LocksmithListResponse)
async def list_locksmiths(
    locksmith_service: LocksmithServiceDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    city: str | None = None,
    is_active: bool | None = None,
    is_available: bool | None = None,
    service_type: str | None = None,
):
    """
    List all locksmiths with optional filters.
    
    Used in Admin Console for locksmith management.
    """
    locksmiths, total = await locksmith_service.list(
        page=page,
        page_size=page_size,
        city=city,
        is_active=is_active,
        is_available=is_available,
        service_type=service_type,
    )

    # Get stats for each locksmith
    items = []
    for locksmith in locksmiths:
        stats = await locksmith_service.get_stats(locksmith.id)
        response = LocksmithResponse.model_validate(locksmith)
        response.stats = stats
        items.append(response)

    return LocksmithListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=LocksmithResponse, status_code=201)
async def create_locksmith(
    data: LocksmithCreate,
    locksmith_service: LocksmithServiceDep,
    audit_service: AuditServiceDep,
):
    """
    Create a new locksmith.
    
    Used for manual onboarding in Admin Console.
    """
    # Check for existing phone
    existing = await locksmith_service.get_by_phone(data.phone)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A locksmith with this phone number already exists",
        )

    locksmith = await locksmith_service.create(data)

    await audit_service.log_admin_action(
        entity_type="locksmith",
        entity_id=str(locksmith.id),
        action="created",
        payload=data.model_dump(),
    )

    return LocksmithResponse.model_validate(locksmith)


@router.get("/{locksmith_id}", response_model=LocksmithResponse)
async def get_locksmith(
    locksmith_id: UUID,
    locksmith_service: LocksmithServiceDep,
):
    """Get a specific locksmith by ID."""
    locksmith = await locksmith_service.get_by_id(locksmith_id)
    if not locksmith:
        raise HTTPException(status_code=404, detail="Locksmith not found")

    stats = await locksmith_service.get_stats(locksmith_id)
    response = LocksmithResponse.model_validate(locksmith)
    response.stats = stats
    return response


@router.patch("/{locksmith_id}", response_model=LocksmithResponse)
async def update_locksmith(
    locksmith_id: UUID,
    data: LocksmithUpdate,
    locksmith_service: LocksmithServiceDep,
    audit_service: AuditServiceDep,
):
    """Update a locksmith's details."""
    locksmith = await locksmith_service.update(locksmith_id, data)
    if not locksmith:
        raise HTTPException(status_code=404, detail="Locksmith not found")

    await audit_service.log_admin_action(
        entity_type="locksmith",
        entity_id=str(locksmith_id),
        action="updated",
        payload=data.model_dump(exclude_unset=True),
    )

    return LocksmithResponse.model_validate(locksmith)


@router.post("/{locksmith_id}/toggle-active", response_model=LocksmithResponse)
async def toggle_locksmith_active(
    locksmith_id: UUID,
    is_active: bool,
    locksmith_service: LocksmithServiceDep,
    audit_service: AuditServiceDep,
):
    """Toggle locksmith active status."""
    locksmith = await locksmith_service.toggle_active(locksmith_id, is_active)
    if not locksmith:
        raise HTTPException(status_code=404, detail="Locksmith not found")

    await audit_service.log_admin_action(
        entity_type="locksmith",
        entity_id=str(locksmith_id),
        action="toggled_active",
        payload={"is_active": is_active},
    )

    return LocksmithResponse.model_validate(locksmith)


@router.post("/{locksmith_id}/toggle-available", response_model=LocksmithResponse)
async def toggle_locksmith_available(
    locksmith_id: UUID,
    is_available: bool,
    locksmith_service: LocksmithServiceDep,
    audit_service: AuditServiceDep,
):
    """Toggle locksmith availability."""
    locksmith = await locksmith_service.toggle_available(locksmith_id, is_available)
    if not locksmith:
        raise HTTPException(status_code=404, detail="Locksmith not found")

    await audit_service.log_admin_action(
        entity_type="locksmith",
        entity_id=str(locksmith_id),
        action="toggled_available",
        payload={"is_available": is_available},
    )

    return LocksmithResponse.model_validate(locksmith)
