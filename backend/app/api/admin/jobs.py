"""Admin API routes for job management."""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession

from app.api.deps import (
    JobServiceDep,
    DispatchServiceDep,
    PaymentServiceDep,
    AuditServiceDep,
    S3ServiceDep,
)
from app.models.job import Job
from app.models.job import JobStatus
from app.models.photo import Photo
from app.schemas.job import (
    JobResponse,
    JobListResponse,
    JobStatusUpdate,
    JobAssignment,
    JobRefund,
    DispatchControl,
    JobOfferResponse,
)

router = APIRouter(prefix="/jobs", tags=["admin-jobs"])


@router.get("", response_model=JobListResponse)
async def list_jobs(
    job_service: JobServiceDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: JobStatus | None = None,
    city: str | None = None,
    service_type: str | None = None,
    customer_phone: str | None = None,
    locksmith_id: UUID | None = None,
):
    """
    List all jobs with optional filters.
    
    This is the primary admin dashboard view.
    """
    jobs, total = await job_service.list(
        page=page,
        page_size=page_size,
        status=status,
        city=city,
        service_type=service_type,
        customer_phone=customer_phone,
        locksmith_id=locksmith_id,
    )

    items = []
    for job in jobs:
        response = JobResponse.model_validate(job)
        if job.assigned_locksmith:
            response.assigned_locksmith_name = job.assigned_locksmith.display_name
        items.append(response)

    return JobListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    job_service: JobServiceDep,
):
    """
    Get full job details including offers.
    
    This is the Job Detail View for admins.
    """
    job = await job_service.get_by_id(job_id, include_offers=True)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = JobResponse.model_validate(job)
    
    if job.assigned_locksmith:
        response.assigned_locksmith_name = job.assigned_locksmith.display_name

    # Include offer details
    if job.job_offers:
        response.offers = [
            JobOfferResponse(
                id=offer.id,
                locksmith_id=offer.locksmith_id,
                locksmith_name=offer.locksmith.display_name if offer.locksmith else None,
                locksmith_phone=offer.locksmith.phone if offer.locksmith else None,
                wave_number=offer.wave_number,
                status=offer.status.value,
                sent_at=offer.sent_at,
                responded_at=offer.responded_at,
            )
            for offer in job.job_offers
        ]

    return response


@router.post("/{job_id}/status", response_model=JobResponse)
async def update_job_status(
    job_id: UUID,
    data: JobStatusUpdate,
    job_service: JobServiceDep,
    audit_service: AuditServiceDep,
):
    """Manually update job status (admin override)."""
    job = await job_service.update_status(job_id, data.status, data.reason)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action="status_updated",
        payload={"new_status": data.status.value, "reason": data.reason},
    )

    return JobResponse.model_validate(job)


@router.post("/{job_id}/assign", response_model=JobResponse)
async def assign_locksmith(
    job_id: UUID,
    data: JobAssignment,
    job_service: JobServiceDep,
    dispatch_service: DispatchServiceDep,
    audit_service: AuditServiceDep,
):
    """Manually assign a locksmith to a job."""
    job = await job_service.assign_locksmith(job_id, data.locksmith_id)
    if not job:
        raise HTTPException(
            status_code=400,
            detail="Could not assign locksmith. Job or locksmith not found/active.",
        )

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action="manually_assigned",
        payload={
            "locksmith_id": str(data.locksmith_id),
            "notify_locksmith": data.notify_locksmith,
            "reason": data.reason,
        },
    )

    return JobResponse.model_validate(job)


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: UUID,
    reason: str | None = None,
    job_service: JobServiceDep = None,
    audit_service: AuditServiceDep = None,
):
    """Cancel a job."""
    job = await job_service.cancel(job_id, reason)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action="canceled",
        payload={"reason": reason},
    )

    return JobResponse.model_validate(job)


@router.post("/{job_id}/complete", response_model=JobResponse)
async def complete_job(
    job_id: UUID,
    job_service: JobServiceDep,
    audit_service: AuditServiceDep,
):
    """Mark job as completed."""
    job = await job_service.mark_completed(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action="completed",
    )

    return JobResponse.model_validate(job)


@router.post("/{job_id}/refund")
async def process_refund(
    job_id: UUID,
    data: JobRefund,
    payment_service: PaymentServiceDep,
    audit_service: AuditServiceDep,
):
    """Process a refund for a job."""
    result = await payment_service.process_refund(
        job_id=job_id,
        amount=data.amount,
        reason=data.reason,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action="refund_initiated",
        payload={
            "amount": data.amount,
            "reason": data.reason,
            "refund_id": result.get("refund_id"),
        },
    )

    return result


@router.post("/{job_id}/dispatch")
async def control_dispatch(
    job_id: UUID,
    data: DispatchControl,
    background_tasks: BackgroundTasks,
    dispatch_service: DispatchServiceDep,
    audit_service: AuditServiceDep,
):
    """Control dispatch: restart, next_wave, or cancel."""
    if data.action == "restart":
        success = await dispatch_service.restart_dispatch(job_id)
    elif data.action == "next_wave":
        sent = await dispatch_service.send_wave(job_id)
        success = sent > 0
    elif data.action == "cancel":
        success = await dispatch_service.cancel_dispatch(job_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    if not success:
        raise HTTPException(status_code=400, detail=f"Could not {data.action} dispatch")

    await audit_service.log_admin_action(
        entity_type="job",
        entity_id=str(job_id),
        action=f"dispatch_{data.action}",
        payload={"reason": data.reason},
    )

    return {"success": True, "action": data.action}


@router.get("/{job_id}/photos")
async def get_job_photos(
    job_id: UUID,
    db: DbSession,
    job_service: JobServiceDep,
    s3_service: S3ServiceDep,
):
    """
    Get all photos for a job with presigned URLs.
    
    Returns presigned URLs valid for 5 minutes for viewing photos.
    """
    # Verify job exists
    job = await job_service.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all photos for this job
    result = await db.execute(
        select(Photo).where(Photo.job_id == job_id).order_by(Photo.created_at.desc())
    )
    photos = result.scalars().all()

    # Generate presigned URLs
    photo_urls = []
    for photo in photos:
        if photo.s3_bucket and s3_service.is_configured():
            try:
                s3_key = photo.get_s3_key()
                if not s3_key:
                    continue
                url = s3_service.get_presigned_url(s3_key, expiration=300)
                photo_urls.append({
                    "photo_id": str(photo.id),
                    "url": url,
                    "content_type": photo.content_type,
                    "bytes": photo.bytes,
                    "source": photo.source,
                    "created_at": photo.created_at.isoformat(),
                })
            except ValueError as e:
                # Log error but continue
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to generate presigned URL for photo {photo.id}: {str(e)}")
        else:
            # Photo not in S3 or S3 not configured
            photo_urls.append({
                "photo_id": str(photo.id),
                "url": None,
                "error": "Photo not available in storage",
                "content_type": photo.content_type,
                "bytes": photo.bytes,
                "source": photo.source,
                "created_at": photo.created_at.isoformat(),
            })

    return {"photos": photo_urls}


@router.get("/{job_id}/photo/{photo_id}/url")
async def get_photo_url(
    job_id: UUID,
    photo_id: UUID,
    db: DbSession,
    job_service: JobServiceDep,
    s3_service: S3ServiceDep,
    expiration: int = Query(300, ge=60, le=3600),  # 5 min to 1 hour
):
    """
    Get a presigned URL for a specific photo.
    
    Returns a presigned URL valid for the specified expiration time (default 5 minutes).
    """
    # Verify job exists
    job = await job_service.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get photo
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.job_id == job_id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not photo.s3_bucket:
        raise HTTPException(status_code=404, detail="Photo not available in storage")

    if not s3_service.is_configured():
        raise HTTPException(status_code=500, detail="Photo storage not configured")

    try:
        s3_key = photo.get_s3_key()
        if not s3_key:
            raise HTTPException(status_code=404, detail="Could not reconstruct S3 path")
        url = s3_service.get_presigned_url(s3_key, expiration=expiration)
        return {
            "photo_id": str(photo.id),
            "url": url,
            "expires_in": expiration,
            "content_type": photo.content_type,
        }
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {str(e)}")
