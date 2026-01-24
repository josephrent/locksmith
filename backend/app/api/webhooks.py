"""Webhook handlers for external services (Twilio, Stripe)."""

import re
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from app.api.deps import DbSession, SMSServiceDep, PaymentServiceDep, DispatchServiceDep
from app.services.locksmith_service import LocksmithService
from app.schemas.message import TwilioWebhook
from app.models.job_offer import JobOffer, OfferStatus
from app.models.request_session import RequestSession, SessionStatus
from app.config import get_settings

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()


@router.post("/twilio/sms")
async def twilio_sms_webhook(
    request: Request,
    db: DbSession,
    sms_service: SMSServiceDep,
    dispatch_service: DispatchServiceDep,
    MessageSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    Body: str = Form(...),
):
    """
    Handle incoming SMS from Twilio.
    
    Processes locksmith commands:
    - Y $[price]: Provide quote
    - N: Decline job
    - AVAILABLE: Opt in to offers
    - UNAVAILABLE: Pause offers
    - STOP: Deactivate
    """
    # Normalize phone number
    from_phone = From.strip()
    body = Body.strip().upper()

    # Log inbound message
    locksmith_service = LocksmithService(db)
    locksmith = await locksmith_service.get_by_phone(from_phone)
    locksmith_id = locksmith.id if locksmith else None

    await sms_service.log_inbound_message(
        from_phone=from_phone,
        to_phone=To,
        body=Body,
        message_sid=MessageSid,
        locksmith_id=locksmith_id,
    )

    # Process command
    response_message = ""

    if not locksmith:
        # Check if this is a customer sending STOP
        if body == "STOP":
            # Find customer by phone number
            customer_session_result = await db.execute(
                select(RequestSession)
                .where(RequestSession.customer_phone == from_phone)
                .order_by(RequestSession.created_at.desc())
                .limit(1)
            )
            customer_session = customer_session_result.scalar_one_or_none()
            
            if customer_session:
                response_message = "You have been unsubscribed from SMS messages. You will no longer receive updates about your service requests."
            else:
                response_message = "You have been unsubscribed. If you need assistance, please contact support."
        else:
            response_message = "Unknown number. Contact support if you're a locksmith."
    elif body.startswith("Y") or body.startswith("y"):
        # Parse quote format: Y $[price] or Y [price]
        price_match = re.search(r'\$?\s*(\d+(?:\.\d{2})?)', body)
        if price_match:
            # Extract price and convert to cents
            price_str = price_match.group(1)
            try:
                price_dollars = float(price_str)
                price_cents = int(price_dollars * 100)
                
                # Find pending offer for this locksmith
                offer_result = await db.execute(
                    select(JobOffer)
                    .where(
                        JobOffer.locksmith_id == locksmith.id,
                        JobOffer.status == OfferStatus.PENDING,
                        JobOffer.request_session_id.isnot(None),
                    )
                    .order_by(JobOffer.sent_at.desc())
                    .limit(1)
                )
                offer = offer_result.scalar_one_or_none()
                
                if offer:
                    # Update offer with quote
                    offer.status = OfferStatus.ACCEPTED
                    offer.quoted_price = price_cents
                    offer.responded_at = datetime.utcnow()
                    await db.flush()
                    
                    # Get request session to send SMS to customer
                    if offer.request_session_id:
                        session_result = await db.execute(
                            select(RequestSession)
                            .where(RequestSession.id == offer.request_session_id)
                        )
                        session = session_result.scalar_one_or_none()
                        
                        if session and session.customer_phone:
                            # Build URL with session ID
                            offers_url = f"{settings.frontend_url}/request/offers?session={offer.request_session_id}"
                            
                            # Send SMS to customer
                            customer_message = (
                                f"Great news! You've received a quote from {locksmith.display_name}: ${price_dollars:.2f}. "
                                f"View all quotes: {offers_url}\n\n"
                                f"Reply STOP to opt out. Msg & data rates may apply."
                            )
                            
                            try:
                                await sms_service.send_sms(
                                    to_phone=session.customer_phone,
                                    body=customer_message,
                                )
                            except Exception as e:
                                import logging
                                logger = logging.getLogger(__name__)
                                logger.error(f"Failed to send SMS to customer: {str(e)}")
                    
                    await db.commit()
                    response_message = f"Quote received: ${price_dollars:.2f}. Customer will be notified."
                else:
                    # Try legacy job-based offers
                    result = await dispatch_service.handle_response(from_phone, "YES")
                    response_message = result.get("message", "Quote received, but no pending offer found.")
            except ValueError:
                response_message = "Invalid price format. Reply: Y $[price] (e.g., Y $150)"
        else:
            response_message = "Please include price. Reply: Y $[price] (e.g., Y $150)"
    elif body in ["NO", "N", "n"]:
        # Find pending offer for this locksmith
        offer_result = await db.execute(
            select(JobOffer)
            .where(
                JobOffer.locksmith_id == locksmith.id,
                JobOffer.status == OfferStatus.PENDING,
                JobOffer.request_session_id.isnot(None),
            )
            .order_by(JobOffer.sent_at.desc())
            .limit(1)
        )
        offer = offer_result.scalar_one_or_none()
        
        if offer:
            # Decline offer
            offer.status = OfferStatus.DECLINED
            offer.responded_at = datetime.utcnow()
            await db.commit()
            response_message = "Offer declined. Thank you for your response."
        else:
            # Try legacy job-based offers
            result = await dispatch_service.handle_response(from_phone, "NO")
            response_message = result.get("message", "Offer declined.")
    elif body == "AVAILABLE":
        await locksmith_service.toggle_available(locksmith.id, True)
        response_message = "You're now available for job offers."
    elif body == "UNAVAILABLE":
        await locksmith_service.toggle_available(locksmith.id, False)
        response_message = "You've paused job offers. Reply AVAILABLE to resume."
    elif body == "STOP":
        await locksmith_service.toggle_active(locksmith.id, False)
        response_message = "You've been deactivated. Contact support to reactivate."
    else:
        response_message = "Reply like Y $100 to quote, N to decline. Give your own price."

    # Return TwiML response
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_message}</Message>
</Response>"""

    return PlainTextResponse(content=twiml, media_type="application/xml")


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    payment_service: PaymentServiceDep,
):
    """
    Handle Stripe webhook events.
    
    Processes:
    - payment_intent.succeeded
    - payment_intent.payment_failed
    - refund.created
    """
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    result = await payment_service.handle_webhook(payload, signature)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return {"received": True, "event_type": result.get("event_type")}
