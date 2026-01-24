"""Service for locksmith management operations."""

from __future__ import annotations
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.locksmith import Locksmith
from app.models.job import Job, JobStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.schemas.locksmith import LocksmithCreate, LocksmithUpdate, LocksmithStats


class LocksmithService:
    """Handles all locksmith-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: LocksmithCreate) -> Locksmith:
        """Create a new locksmith."""
        locksmith = Locksmith(
            display_name=data.display_name,
            phone=data.phone,
            primary_city=data.primary_city,
            supports_home_lockout=data.supports_home_lockout,
            supports_car_lockout=data.supports_car_lockout,
            supports_rekey=data.supports_rekey,
            supports_smart_lock=data.supports_smart_lock,
            is_active=data.is_active,
            is_available=data.is_available,
            typical_hours=data.typical_hours,
            notes=data.notes,
        )
        self.db.add(locksmith)
        await self.db.commit()
        await self.db.refresh(locksmith)
        return locksmith

    async def get_by_id(self, locksmith_id: UUID) -> Locksmith | None:
        """Get a locksmith by ID."""
        result = await self.db.execute(
            select(Locksmith).where(Locksmith.id == locksmith_id)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Locksmith | None:
        """Get a locksmith by phone number."""
        result = await self.db.execute(
            select(Locksmith).where(Locksmith.phone == phone)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        city: str | None = None,
        is_active: bool | None = None,
        is_available: bool | None = None,
        service_type: str | None = None,
    ) -> tuple[list[Locksmith], int]:
        """List locksmiths with optional filters."""
        query = select(Locksmith)

        if city:
            query = query.where(Locksmith.primary_city == city)
        if is_active is not None:
            query = query.where(Locksmith.is_active == is_active)
        if is_available is not None:
            query = query.where(Locksmith.is_available == is_available)
        if service_type:
            service_filter = {
                "home_lockout": Locksmith.supports_home_lockout,
                "car_lockout": Locksmith.supports_car_lockout,
                "rekey": Locksmith.supports_rekey,
                "smart_lock": Locksmith.supports_smart_lock,
            }
            if service_type in service_filter:
                query = query.where(service_filter[service_type] == True)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate
        query = query.order_by(Locksmith.display_name)
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        locksmiths = list(result.scalars().all())

        return locksmiths, total

    async def update(self, locksmith_id: UUID, data: LocksmithUpdate) -> Locksmith | None:
        """Update a locksmith."""
        locksmith = await self.get_by_id(locksmith_id)
        if not locksmith:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(locksmith, field, value)

        await self.db.commit()
        await self.db.refresh(locksmith)
        return locksmith

    async def toggle_active(self, locksmith_id: UUID, is_active: bool) -> Locksmith | None:
        """Toggle locksmith active status."""
        locksmith = await self.get_by_id(locksmith_id)
        if not locksmith:
            return None

        locksmith.is_active = is_active
        if not is_active:
            locksmith.is_available = False

        await self.db.commit()
        await self.db.refresh(locksmith)
        return locksmith

    async def toggle_available(self, locksmith_id: UUID, is_available: bool) -> Locksmith | None:
        """Toggle locksmith availability."""
        locksmith = await self.get_by_id(locksmith_id)
        if not locksmith:
            return None

        locksmith.is_available = is_available
        await self.db.commit()
        await self.db.refresh(locksmith)
        return locksmith

    async def get_stats(self, locksmith_id: UUID) -> LocksmithStats:
        """Get performance statistics for a locksmith."""
        # Total jobs assigned
        total_jobs_result = await self.db.execute(
            select(func.count()).where(Job.assigned_locksmith_id == locksmith_id)
        )
        total_jobs = total_jobs_result.scalar() or 0

        # Completed jobs
        completed_jobs_result = await self.db.execute(
            select(func.count()).where(
                Job.assigned_locksmith_id == locksmith_id,
                Job.status == JobStatus.COMPLETED,
            )
        )
        completed_jobs = completed_jobs_result.scalar() or 0

        # Acceptance rate
        total_offers_result = await self.db.execute(
            select(func.count()).where(JobOffer.locksmith_id == locksmith_id)
        )
        total_offers = total_offers_result.scalar() or 0

        accepted_offers_result = await self.db.execute(
            select(func.count()).where(
                JobOffer.locksmith_id == locksmith_id,
                JobOffer.status == OfferStatus.ACCEPTED,
            )
        )
        accepted_offers = accepted_offers_result.scalar() or 0

        acceptance_rate = (accepted_offers / total_offers * 100) if total_offers > 0 else 0.0

        return LocksmithStats(
            total_jobs=total_jobs,
            completed_jobs=completed_jobs,
            acceptance_rate=round(acceptance_rate, 1),
        )

    async def find_available_for_job(
        self,
        city: str,
        service_type: str,
        exclude_ids: list[UUID] | None = None,
        limit: int = 3,
    ) -> list[Locksmith]:
        """Find available locksmiths for a job."""
        query = select(Locksmith).where(
            Locksmith.is_active == True,
            Locksmith.is_available == True,
            Locksmith.primary_city == city,
        )

        # Filter by service type
        service_filter = {
            "home_lockout": Locksmith.supports_home_lockout,
            "car_lockout": Locksmith.supports_car_lockout,
            "rekey": Locksmith.supports_rekey,
            "smart_lock": Locksmith.supports_smart_lock,
        }
        if service_type in service_filter:
            query = query.where(service_filter[service_type] == True)

        # Exclude already contacted locksmiths
        if exclude_ids:
            query = query.where(Locksmith.id.notin_(exclude_ids))

        query = query.limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())
