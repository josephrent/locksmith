"""Service for job management operations."""

from __future__ import annotations
from datetime import datetime
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Job, JobStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.models.locksmith import Locksmith
from app.models.request_session import RequestSession, SessionStatus


class JobService:
    """Handles all job-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_from_session(
        self,
        session: RequestSession,
        stripe_payment_intent_id: str,
        car_make: str | None = None,
        car_model: str | None = None,
        car_year: int | None = None,
    ) -> Job:
        """Create a job from a completed request session."""
        job = Job(
            customer_name=session.customer_name,
            customer_phone=session.customer_phone,
            service_type=session.service_type,
            urgency=session.urgency,
            description=session.description,
            address=session.address,
            city=session.city,
            latitude=session.latitude,
            longitude=session.longitude,
            deposit_amount=session.deposit_amount,
            stripe_payment_intent_id=stripe_payment_intent_id,
            stripe_payment_status="succeeded",
            request_session_id=session.id,
            status=JobStatus.CREATED,
            car_make=car_make,
            car_model=car_model,
            car_year=car_year,
        )
        
        self.db.add(job)
        
        # Update session status
        session.status = SessionStatus.PAYMENT_COMPLETED
        session.completed_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get_by_id(self, job_id: UUID, include_offers: bool = False) -> Job | None:
        """Get a job by ID."""
        query = select(Job).where(Job.id == job_id)
        
        if include_offers:
            query = query.options(
                selectinload(Job.job_offers).selectinload(JobOffer.locksmith),
                selectinload(Job.assigned_locksmith),
            )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: JobStatus | None = None,
        city: str | None = None,
        service_type: str | None = None,
        customer_phone: str | None = None,
        locksmith_id: UUID | None = None,
    ) -> tuple[list[Job], int]:
        """List jobs with optional filters."""
        query = select(Job).options(selectinload(Job.assigned_locksmith))

        if status:
            query = query.where(Job.status == status)
        if city:
            query = query.where(Job.city == city)
        if service_type:
            query = query.where(Job.service_type == service_type)
        if customer_phone:
            query = query.where(Job.customer_phone == customer_phone)
        if locksmith_id:
            query = query.where(Job.assigned_locksmith_id == locksmith_id)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate and order by most recent first
        query = query.order_by(Job.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        jobs = list(result.scalars().all())

        return jobs, total

    async def update_status(
        self,
        job_id: UUID,
        new_status: JobStatus,
        reason: str | None = None,
    ) -> Job | None:
        """Update job status."""
        job = await self.get_by_id(job_id)
        if not job:
            return None

        job.status = new_status
        
        if new_status == JobStatus.COMPLETED:
            job.completed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def assign_locksmith(
        self,
        job_id: UUID,
        locksmith_id: UUID,
    ) -> Job | None:
        """Manually assign a locksmith to a job."""
        job = await self.get_by_id(job_id)
        if not job:
            return None

        # Verify locksmith exists and is active
        locksmith_result = await self.db.execute(
            select(Locksmith).where(Locksmith.id == locksmith_id)
        )
        locksmith = locksmith_result.scalar_one_or_none()
        if not locksmith or not locksmith.is_active:
            return None

        job.assigned_locksmith_id = locksmith_id
        job.assigned_at = datetime.utcnow()
        job.status = JobStatus.ASSIGNED

        # Cancel any pending offers
        await self.db.execute(
            JobOffer.__table__.update()
            .where(
                JobOffer.job_id == job_id,
                JobOffer.status == OfferStatus.PENDING,
            )
            .values(status=OfferStatus.CANCELED)
        )

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def cancel(self, job_id: UUID, reason: str | None = None) -> Job | None:
        """Cancel a job."""
        job = await self.get_by_id(job_id)
        if not job:
            return None

        job.status = JobStatus.CANCELED

        # Cancel any pending offers
        await self.db.execute(
            JobOffer.__table__.update()
            .where(
                JobOffer.job_id == job_id,
                JobOffer.status == OfferStatus.PENDING,
            )
            .values(status=OfferStatus.CANCELED)
        )

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def mark_en_route(self, job_id: UUID) -> Job | None:
        """Mark job as locksmith en route."""
        job = await self.get_by_id(job_id)
        if not job or job.status != JobStatus.ASSIGNED:
            return None

        job.status = JobStatus.EN_ROUTE
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def mark_completed(self, job_id: UUID) -> Job | None:
        """Mark job as completed."""
        job = await self.get_by_id(job_id)
        if not job:
            return None

        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get_active_job_for_phone(self, phone: str) -> Job | None:
        """Get the most recent active job for a phone number."""
        result = await self.db.execute(
            select(Job)
            .where(
                Job.customer_phone == phone,
                Job.status.in_([
                    JobStatus.CREATED,
                    JobStatus.DISPATCHING,
                    JobStatus.OFFERED,
                    JobStatus.ASSIGNED,
                    JobStatus.EN_ROUTE,
                ]),
            )
            .order_by(Job.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_pending_offer_for_locksmith(
        self,
        locksmith_phone: str,
    ) -> tuple[JobOffer | None, Job | None]:
        """Get the most recent pending offer for a locksmith."""
        result = await self.db.execute(
            select(JobOffer, Job)
            .join(Job, JobOffer.job_id == Job.id)
            .join(Locksmith, JobOffer.locksmith_id == Locksmith.id)
            .where(
                Locksmith.phone == locksmith_phone,
                JobOffer.status == OfferStatus.PENDING,
            )
            .order_by(JobOffer.sent_at.desc())
            .limit(1)
        )
        row = result.first()
        if row:
            return row[0], row[1]
        return None, None
