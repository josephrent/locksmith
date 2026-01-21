"""Admin API routes for message audit log."""

from uuid import UUID
from fastapi import APIRouter, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.models.message import Message, MessageDirection
from app.models.locksmith import Locksmith
from app.models.job import Job
from app.schemas.message import MessageResponse, MessageListResponse

router = APIRouter(prefix="/messages", tags=["admin-messages"])


@router.get("", response_model=MessageListResponse)
async def list_messages(
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    job_id: UUID | None = None,
    locksmith_id: UUID | None = None,
    direction: MessageDirection | None = None,
    has_error: bool | None = None,
):
    """
    List all SMS messages for audit purposes.
    
    Used for:
    - Dispute resolution
    - Debugging delivery issues
    - Dispatch monitoring
    """
    query = select(Message)

    if job_id:
        query = query.where(Message.job_id == job_id)
    if locksmith_id:
        query = query.where(Message.locksmith_id == locksmith_id)
    if direction:
        query = query.where(Message.direction == direction)
    if has_error is True:
        query = query.where(Message.error_code.isnot(None))
    elif has_error is False:
        query = query.where(Message.error_code.is_(None))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate and order by most recent
    query = query.order_by(Message.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    # Enrich with locksmith and job info
    items = []
    for msg in messages:
        response = MessageResponse.model_validate(msg)
        
        # Get locksmith name if available
        if msg.locksmith_id:
            locksmith_result = await db.execute(
                select(Locksmith.display_name).where(Locksmith.id == msg.locksmith_id)
            )
            locksmith_name = locksmith_result.scalar_one_or_none()
            response.locksmith_name = locksmith_name

        # Get job service type if available
        if msg.job_id:
            job_result = await db.execute(
                select(Job.service_type).where(Job.id == msg.job_id)
            )
            service_type = job_result.scalar_one_or_none()
            response.job_service_type = service_type

        items.append(response)

    return MessageListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/stats")
async def get_message_stats(db: DbSession):
    """Get message delivery statistics."""
    # Total messages
    total_result = await db.execute(select(func.count(Message.id)))
    total = total_result.scalar() or 0

    # Outbound messages
    outbound_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.direction == MessageDirection.OUTBOUND
        )
    )
    outbound = outbound_result.scalar() or 0

    # Inbound messages
    inbound_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.direction == MessageDirection.INBOUND
        )
    )
    inbound = inbound_result.scalar() or 0

    # Failed messages
    failed_result = await db.execute(
        select(func.count(Message.id)).where(Message.error_code.isnot(None))
    )
    failed = failed_result.scalar() or 0

    return {
        "total": total,
        "outbound": outbound,
        "inbound": inbound,
        "failed": failed,
        "delivery_rate": round((outbound - failed) / outbound * 100, 1) if outbound > 0 else 100,
    }
