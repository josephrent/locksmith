"""Admin API routes for request session management."""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.models.request_session import RequestSession, SessionStatus
from app.schemas.request_session import RequestSessionResponse, RequestSessionListResponse

router = APIRouter(prefix="/sessions", tags=["admin-sessions"])


@router.get("", response_model=RequestSessionListResponse)
async def list_sessions(
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: SessionStatus | None = None,
    is_in_service_area: bool | None = None,
):
    """
    List request sessions for funnel analysis.
    
    Used to view:
    - Abandoned requests
    - Ineligible locations
    - Drop-off between steps
    """
    query = select(RequestSession)

    if status:
        query = query.where(RequestSession.status == status)
    if is_in_service_area is not None:
        query = query.where(RequestSession.is_in_service_area == is_in_service_area)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(RequestSession.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    sessions = list(result.scalars().all())

    items = []
    for session in sessions:
        response = RequestSessionResponse.model_validate(session)
        if session.job:
            response.job_id = session.job.id
        items.append(response)

    return RequestSessionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{session_id}", response_model=RequestSessionResponse)
async def get_session(
    session_id: UUID,
    db: DbSession,
):
    """Get a specific request session."""
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    response = RequestSessionResponse.model_validate(session)
    if session.job:
        response.job_id = session.job.id
    return response


@router.get("/stats/funnel")
async def get_funnel_stats(db: DbSession):
    """
    Get conversion funnel statistics.
    
    Shows drop-off rates between steps.
    """
    # Total sessions started
    total_result = await db.execute(select(func.count(RequestSession.id)))
    total_started = total_result.scalar() or 0

    # Location validated
    location_validated_result = await db.execute(
        select(func.count(RequestSession.id)).where(
            RequestSession.step_reached >= 1,
            RequestSession.is_in_service_area == True,
        )
    )
    location_validated = location_validated_result.scalar() or 0

    # Location rejected (outside service area)
    location_rejected_result = await db.execute(
        select(func.count(RequestSession.id)).where(
            RequestSession.is_in_service_area == False,
        )
    )
    location_rejected = location_rejected_result.scalar() or 0

    # Service selected (step 2)
    service_selected_result = await db.execute(
        select(func.count(RequestSession.id)).where(
            RequestSession.step_reached >= 2,
        )
    )
    service_selected = service_selected_result.scalar() or 0

    # Payment completed
    payment_completed_result = await db.execute(
        select(func.count(RequestSession.id)).where(
            RequestSession.status == SessionStatus.PAYMENT_COMPLETED,
        )
    )
    payment_completed = payment_completed_result.scalar() or 0

    # Abandoned (started but not completed)
    abandoned_result = await db.execute(
        select(func.count(RequestSession.id)).where(
            RequestSession.status == SessionStatus.ABANDONED,
        )
    )
    abandoned = abandoned_result.scalar() or 0

    return {
        "total_started": total_started,
        "location_validated": location_validated,
        "location_rejected": location_rejected,
        "service_selected": service_selected,
        "payment_completed": payment_completed,
        "abandoned": abandoned,
        "conversion_rate": (
            round(payment_completed / total_started * 100, 1)
            if total_started > 0
            else 0
        ),
    }
