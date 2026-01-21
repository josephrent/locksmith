"""Service for payment operations via Stripe."""

from uuid import UUID
import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.job import Job
from app.models.request_session import RequestSession
from app.services.audit_service import AuditService

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


class PaymentService:
    """Handles all payment operations via Stripe."""

    def __init__(self, db: AsyncSession, audit_service: AuditService | None = None):
        self.db = db
        self.audit_service = audit_service

    async def create_payment_intent(
        self,
        session_id: UUID,
        amount: int,
    ) -> dict:
        """
        Create a Stripe PaymentIntent for a request session.
        
        Args:
            session_id: Request session UUID
            amount: Amount in cents
            
        Returns:
            Dict with client_secret and payment_intent_id
        """
        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata={
                "session_id": str(session_id),
            },
        )

        # Update session with payment intent
        result = await self.db.execute(
            select(RequestSession).where(RequestSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.stripe_payment_intent_id = intent.id
            await self.db.commit()

        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount": amount,
        }

    async def confirm_payment(self, payment_intent_id: str) -> bool:
        """
        Verify a payment was successful.
        
        Called after webhook or on completion.
        """
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return intent.status == "succeeded"
        except stripe.StripeError:
            return False

    async def process_refund(
        self,
        job_id: UUID,
        amount: int | None = None,
        reason: str = "requested_by_customer",
    ) -> dict:
        """
        Process a refund for a job.
        
        Args:
            job_id: Job UUID
            amount: Amount to refund in cents (None for full refund)
            reason: Reason for refund
            
        Returns:
            Dict with refund details
        """
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job or not job.stripe_payment_intent_id:
            return {"success": False, "error": "No payment found for this job"}

        try:
            refund_params = {
                "payment_intent": job.stripe_payment_intent_id,
                "reason": reason,
            }
            if amount:
                refund_params["amount"] = amount

            refund = stripe.Refund.create(**refund_params)

            # Update job
            job.refund_amount = refund.amount
            job.stripe_refund_id = refund.id
            await self.db.commit()

            if self.audit_service:
                await self.audit_service.log_event(
                    entity_type="job",
                    entity_id=str(job_id),
                    event_type="refund_processed",
                    payload={
                        "refund_id": refund.id,
                        "amount": refund.amount,
                        "reason": reason,
                    },
                )

            return {
                "success": True,
                "refund_id": refund.id,
                "amount": refund.amount,
                "status": refund.status,
            }

        except stripe.StripeError as e:
            return {"success": False, "error": str(e)}

    async def handle_webhook(self, payload: bytes, signature: str) -> dict:
        """
        Handle Stripe webhook events.
        
        Returns dict with event processing result.
        """
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                settings.stripe_webhook_secret,
            )
        except ValueError:
            return {"success": False, "error": "Invalid payload"}
        except stripe.SignatureVerificationError:
            return {"success": False, "error": "Invalid signature"}

        event_type = event["type"]
        data = event["data"]["object"]

        if event_type == "payment_intent.succeeded":
            await self._handle_payment_success(data)
        elif event_type == "payment_intent.payment_failed":
            await self._handle_payment_failure(data)
        elif event_type == "refund.created":
            await self._handle_refund_created(data)

        return {"success": True, "event_type": event_type}

    async def _handle_payment_success(self, payment_intent: dict):
        """Handle successful payment."""
        session_id = payment_intent.get("metadata", {}).get("session_id")
        if not session_id:
            return

        # This is handled by the customer flow endpoint
        # Just log for audit
        if self.audit_service:
            await self.audit_service.log_event(
                entity_type="payment",
                entity_id=payment_intent["id"],
                event_type="payment_succeeded",
                payload={"session_id": session_id, "amount": payment_intent["amount"]},
            )

    async def _handle_payment_failure(self, payment_intent: dict):
        """Handle failed payment."""
        session_id = payment_intent.get("metadata", {}).get("session_id")
        if self.audit_service:
            await self.audit_service.log_event(
                entity_type="payment",
                entity_id=payment_intent["id"],
                event_type="payment_failed",
                payload={
                    "session_id": session_id,
                    "error": payment_intent.get("last_payment_error"),
                },
            )

    async def _handle_refund_created(self, refund: dict):
        """Handle refund creation."""
        if self.audit_service:
            await self.audit_service.log_event(
                entity_type="refund",
                entity_id=refund["id"],
                event_type="refund_created",
                payload={
                    "payment_intent": refund["payment_intent"],
                    "amount": refund["amount"],
                    "status": refund["status"],
                },
            )
