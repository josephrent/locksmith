"""Service for job dispatch operations."""

from __future__ import annotations
import asyncio
from datetime import datetime, timedelta
from uuid import UUID
import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.job import Job, JobStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.models.locksmith import Locksmith
from app.services.locksmith_service import LocksmithService
from app.services.sms_service import SMSService
from app.services.audit_service import AuditService

settings = get_settings()


class DispatchService:
    """Handles job dispatch logic with wave-based SMS offers."""

    def __init__(
        self,
        db: AsyncSession,
        redis_client: redis.Redis,
        sms_service: SMSService,
        audit_service: AuditService,
    ):
        self.db = db
        self.redis = redis_client
        self.sms_service = sms_service
        self.audit_service = audit_service
        self.locksmith_service = LocksmithService(db)

    async def start_dispatch(self, job_id: UUID) -> bool:
        """Start the dispatch process for a job."""
        job = await self._get_job(job_id)
        if not job or job.status != JobStatus.CREATED:
            return False

        # Update job status
        job.status = JobStatus.DISPATCHING
        job.dispatch_started_at = datetime.utcnow()
        job.current_wave = 0
        await self.db.commit()

        # Log event
        await self.audit_service.log_event(
            entity_type="job",
            entity_id=str(job_id),
            event_type="dispatch_started",
            payload={"service_type": job.service_type, "city": job.city},
        )

        # Start first wave
        await self.send_wave(job_id)
        return True

    async def send_wave(self, job_id: UUID) -> int:
        """Send offers to a wave of locksmiths. Returns number of offers sent."""
        job = await self._get_job(job_id)
        if not job or job.status not in [JobStatus.DISPATCHING, JobStatus.OFFERED]:
            return 0

        # Get already contacted locksmith IDs
        existing_offers_result = await self.db.execute(
            select(JobOffer.locksmith_id).where(JobOffer.job_id == job_id)
        )
        contacted_ids = [row[0] for row in existing_offers_result.fetchall()]

        # Find available locksmiths
        available = await self.locksmith_service.find_available_for_job(
            city=job.city,
            service_type=job.service_type,
            exclude_ids=contacted_ids,
            limit=settings.dispatch_wave_size,
        )

        if not available:
            # No more locksmiths available
            if not contacted_ids:
                # No one was ever contacted - fail immediately
                job.status = JobStatus.FAILED
                await self.db.commit()
                await self.audit_service.log_event(
                    entity_type="job",
                    entity_id=str(job_id),
                    event_type="dispatch_failed",
                    payload={"reason": "no_locksmiths_available"},
                )
            return 0

        # Increment wave
        job.current_wave += 1
        job.status = JobStatus.OFFERED
        wave_number = job.current_wave

        # Create offers and send SMS
        offers_sent = 0
        for locksmith in available:
            try:
                # Create offer record
                offer = JobOffer(
                    job_id=job_id,
                    locksmith_id=locksmith.id,
                    wave_number=wave_number,
                    status=OfferStatus.PENDING,
                    expires_at=datetime.utcnow() + timedelta(seconds=settings.dispatch_wave_delay_seconds),
                )
                self.db.add(offer)
                await self.db.flush()

                # Send SMS
                message = self._build_offer_message(job, locksmith)
                message_sid = await self.sms_service.send_sms(
                    to_phone=locksmith.phone,
                    body=message,
                    job_id=job_id,
                    locksmith_id=locksmith.id,
                )
                offer.twilio_message_sid = message_sid
                offers_sent += 1

            except Exception as e:
                await self.audit_service.log_event(
                    entity_type="job_offer",
                    entity_id=str(offer.id) if offer else "unknown",
                    event_type="offer_send_failed",
                    payload={"error": str(e), "locksmith_id": str(locksmith.id)},
                )

        await self.db.commit()

        await self.audit_service.log_event(
            entity_type="job",
            entity_id=str(job_id),
            event_type="wave_sent",
            payload={
                "wave_number": wave_number,
                "offers_sent": offers_sent,
                "locksmith_ids": [str(l.id) for l in available],
            },
        )

        return offers_sent

    async def handle_response(
        self,
        locksmith_phone: str,
        response: str,
    ) -> dict:
        """Handle YES/NO response from a locksmith."""
        response = response.strip().upper()

        # Find locksmith
        locksmith = await self.locksmith_service.get_by_phone(locksmith_phone)
        if not locksmith:
            return {"success": False, "message": "Unknown phone number"}

        # Find pending offer
        offer_result = await self.db.execute(
            select(JobOffer)
            .where(
                JobOffer.locksmith_id == locksmith.id,
                JobOffer.status == OfferStatus.PENDING,
            )
            .order_by(JobOffer.sent_at.desc())
            .limit(1)
        )
        offer = offer_result.scalar_one_or_none()

        if not offer:
            return {"success": False, "message": "No pending job offer"}

        job = await self._get_job(offer.job_id)
        if not job:
            return {"success": False, "message": "Job not found"}

        if response == "YES":
            return await self._accept_offer(offer, job, locksmith)
        elif response == "NO":
            return await self._decline_offer(offer, job, locksmith)
        else:
            return {"success": False, "message": "Reply YES or NO"}

    async def _accept_offer(
        self,
        offer: JobOffer,
        job: Job,
        locksmith: Locksmith,
    ) -> dict:
        """Process offer acceptance with atomic locking."""
        lock_key = f"job_assignment:{job.id}"

        # Try to acquire lock
        acquired = await self.redis.set(lock_key, str(locksmith.id), nx=True, ex=30)
        if not acquired:
            # Someone else got it first
            offer.status = OfferStatus.CANCELED
            offer.responded_at = datetime.utcnow()
            await self.db.commit()
            return {"success": False, "message": "Job already assigned"}

        try:
            # Double-check job status
            if job.status not in [JobStatus.DISPATCHING, JobStatus.OFFERED]:
                offer.status = OfferStatus.CANCELED
                offer.responded_at = datetime.utcnow()
                await self.db.commit()
                return {"success": False, "message": "Job no longer available"}

            # Accept this offer
            offer.status = OfferStatus.ACCEPTED
            offer.responded_at = datetime.utcnow()

            # Assign locksmith to job
            job.assigned_locksmith_id = locksmith.id
            job.assigned_at = datetime.utcnow()
            job.status = JobStatus.ASSIGNED

            # Cancel all other pending offers for this job
            await self.db.execute(
                JobOffer.__table__.update()
                .where(
                    JobOffer.job_id == job.id,
                    JobOffer.id != offer.id,
                    JobOffer.status == OfferStatus.PENDING,
                )
                .values(status=OfferStatus.CANCELED)
            )

            await self.db.commit()

            # Send confirmation to locksmith
            await self.sms_service.send_sms(
                to_phone=locksmith.phone,
                body=f"Job confirmed! Customer: {job.customer_name} at {job.address}. Please head there now.",
                job_id=job.id,
                locksmith_id=locksmith.id,
            )

            # Notify customer
            await self.sms_service.send_sms(
                to_phone=job.customer_phone,
                body=f"Good news! {locksmith.display_name} is on the way to help you.",
                job_id=job.id,
            )

            await self.audit_service.log_event(
                entity_type="job",
                entity_id=str(job.id),
                event_type="job_assigned",
                payload={
                    "locksmith_id": str(locksmith.id),
                    "locksmith_name": locksmith.display_name,
                    "wave_number": offer.wave_number,
                },
            )

            return {"success": True, "message": "Job assigned successfully"}

        finally:
            await self.redis.delete(lock_key)

    async def _decline_offer(
        self,
        offer: JobOffer,
        job: Job,
        locksmith: Locksmith,
    ) -> dict:
        """Process offer decline."""
        offer.status = OfferStatus.DECLINED
        offer.responded_at = datetime.utcnow()
        await self.db.commit()

        await self.audit_service.log_event(
            entity_type="job_offer",
            entity_id=str(offer.id),
            event_type="offer_declined",
            payload={"locksmith_id": str(locksmith.id)},
        )

        # Check if all offers in this wave are resolved
        pending_result = await self.db.execute(
            select(JobOffer)
            .where(
                JobOffer.job_id == job.id,
                JobOffer.status == OfferStatus.PENDING,
            )
        )
        pending_offers = pending_result.scalars().all()

        if not pending_offers and job.status == JobStatus.OFFERED:
            # All offers declined, send next wave
            sent = await self.send_wave(job.id)
            if sent == 0:
                # No more locksmiths, fail the job
                job.status = JobStatus.FAILED
                await self.db.commit()

                await self.audit_service.log_event(
                    entity_type="job",
                    entity_id=str(job.id),
                    event_type="dispatch_failed",
                    payload={"reason": "all_declined_or_no_more_locksmiths"},
                )

                # Notify customer
                await self.sms_service.send_sms(
                    to_phone=job.customer_phone,
                    body="We're sorry, we couldn't find an available locksmith. A refund will be processed.",
                    job_id=job.id,
                )

        return {"success": True, "message": "Offer declined"}

    async def cancel_dispatch(self, job_id: UUID) -> bool:
        """Cancel dispatch for a job."""
        job = await self._get_job(job_id)
        if not job:
            return False

        # Cancel all pending offers
        await self.db.execute(
            JobOffer.__table__.update()
            .where(
                JobOffer.job_id == job_id,
                JobOffer.status == OfferStatus.PENDING,
            )
            .values(status=OfferStatus.CANCELED)
        )

        job.status = JobStatus.CANCELED
        await self.db.commit()

        await self.audit_service.log_event(
            entity_type="job",
            entity_id=str(job_id),
            event_type="dispatch_canceled",
        )

        return True

    async def restart_dispatch(self, job_id: UUID) -> bool:
        """Restart dispatch from the beginning."""
        job = await self._get_job(job_id)
        if not job:
            return False

        # Cancel all existing offers
        await self.db.execute(
            JobOffer.__table__.update()
            .where(JobOffer.job_id == job_id)
            .values(status=OfferStatus.CANCELED)
        )

        # Reset job
        job.status = JobStatus.CREATED
        job.current_wave = 0
        job.dispatch_started_at = None
        job.assigned_locksmith_id = None
        job.assigned_at = None
        await self.db.commit()

        await self.audit_service.log_event(
            entity_type="job",
            entity_id=str(job_id),
            event_type="dispatch_restarted",
        )

        # Start fresh dispatch
        return await self.start_dispatch(job_id)

    def _build_offer_message(self, job: Job, locksmith: Locksmith) -> str:
        """Build the SMS offer message."""
        service_names = {
            "home_lockout": "Home Lockout",
            "car_lockout": "Car Lockout",
            "rekey": "Lock Rekey",
            "smart_lock": "Smart Lock Install",
        }
        service = service_names.get(job.service_type, job.service_type)
        
        return (
            f"New job! {service} at {job.city}. "
            f"Reply YES to accept or NO to decline."
        )

    async def _get_job(self, job_id: UUID) -> Job | None:
        """Get a job by ID."""
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        return result.scalar_one_or_none()
