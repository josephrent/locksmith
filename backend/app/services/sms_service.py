"""Service for SMS operations via Twilio."""

from uuid import UUID
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.message import Message, MessageDirection

settings = get_settings()


class SMSService:
    """Handles all SMS operations via Twilio."""

    def __init__(self, db: AsyncSession):
        self.db = db
        # Only create Twilio client if credentials are available
        if settings.twilio_account_sid and settings.twilio_auth_token:
            self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        else:
            self.client = None
        self.from_phone = settings.twilio_phone_number or "+15555555555"  # Dummy for dev

    async def send_sms(
        self,
        to_phone: str,
        body: str,
        job_id: UUID | None = None,
        locksmith_id: UUID | None = None,
    ) -> str | None:
        """
        Send an SMS message and log it.
        
        Returns the Twilio message SID if successful.
        """
        message_record = Message(
            job_id=job_id,
            locksmith_id=locksmith_id,
            direction=MessageDirection.OUTBOUND,
            to_phone=to_phone,
            from_phone=self.from_phone,
            body=body,
        )

        try:
            # In development mode without Twilio, just log the message
            if settings.app_env == "development" and not self.client:
                message_record.provider_message_id = f"dev_msg_{job_id or 'none'}"
                message_record.delivery_status = "dev_mode"
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"[DEV MODE] Would send SMS to {to_phone}: {body}")
            else:
                # Send via Twilio
                if not self.client:
                    raise ValueError("Twilio client not initialized")
                
                twilio_message = self.client.messages.create(
                    body=body,
                    from_=self.from_phone,
                    to=to_phone,
                )

                message_record.provider_message_id = twilio_message.sid
                message_record.delivery_status = twilio_message.status

        except (TwilioRestException, ValueError) as e:
            message_record.error_code = str(getattr(e, 'code', 'unknown'))
            message_record.error_message = str(e)
            message_record.delivery_status = "failed"

        # Save message record
        self.db.add(message_record)
        await self.db.commit()

        return message_record.provider_message_id

    async def log_inbound_message(
        self,
        from_phone: str,
        to_phone: str,
        body: str,
        message_sid: str,
        job_id: UUID | None = None,
        locksmith_id: UUID | None = None,
    ) -> Message:
        """Log an inbound SMS message."""
        message_record = Message(
            job_id=job_id,
            locksmith_id=locksmith_id,
            direction=MessageDirection.INBOUND,
            to_phone=to_phone,
            from_phone=from_phone,
            body=body,
            provider_message_id=message_sid,
            delivery_status="received",
        )

        self.db.add(message_record)
        await self.db.commit()
        await self.db.refresh(message_record)

        return message_record

    async def send_customer_confirmation(self, job_id: UUID, customer_phone: str):
        """Send job creation confirmation to customer."""
        await self.send_sms(
            to_phone=customer_phone,
            body="Your locksmith request has been received! We're finding someone to help you now.",
            job_id=job_id,
        )

    async def send_availability_commands_help(self, to_phone: str):
        """Send SMS commands help to a locksmith."""
        await self.send_sms(
            to_phone=to_phone,
            body=(
                "Commands:\n"
                "YES - Accept job\n"
                "NO - Decline job\n"
                "AVAILABLE - Get job offers\n"
                "UNAVAILABLE - Pause offers\n"
                "STOP - Deactivate"
            ),
        )
