"""Webhook handlers for external services (Twilio, Stripe)."""

from fastapi import APIRouter, Request, HTTPException, Form
from fastapi.responses import PlainTextResponse

from app.api.deps import DbSession, SMSServiceDep, PaymentServiceDep, DispatchServiceDep
from app.services.locksmith_service import LocksmithService
from app.schemas.message import TwilioWebhook

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


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
    - YES: Accept job
    - NO: Decline job
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
        response_message = "Unknown number. Contact support if you're a locksmith."
    elif body in ["YES", "NO"]:
        result = await dispatch_service.handle_response(from_phone, body)
        response_message = result.get("message", "")
    elif body == "AVAILABLE":
        await locksmith_service.toggle_available(locksmith.id, True)
        response_message = "You're now available for job offers."
    elif body == "UNAVAILABLE":
        await locksmith_service.toggle_available(locksmith.id, False)
        response_message = "You've paused job offers. Reply AVAILABLE to resume."
    elif body == "STOP":
        await locksmith_service.toggle_active(locksmith.id, False)
        response_message = "You've been deactivated. Contact support to reactivate."
    elif body == "HELP":
        response_message = (
            "Commands: YES (accept job), NO (decline), "
            "AVAILABLE (get offers), UNAVAILABLE (pause), STOP (deactivate)"
        )
    else:
        response_message = "Reply YES, NO, AVAILABLE, UNAVAILABLE, or HELP"

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
