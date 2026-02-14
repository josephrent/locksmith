"""Customer API routes - public, no authentication required."""

import logging
import uuid
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import googlemaps

from app.api.deps import DbSession, PaymentServiceDep, DispatchServiceDep, SMSServiceDep, S3ServiceDep
from app.config import get_settings
from app.models.request_session import RequestSession, SessionStatus
from app.models.job import Job
from app.models.photo import Photo
from app.models.job_offer import JobOffer, OfferStatus
from app.models.locksmith import Locksmith
from app.services.job_service import JobService
from app.services.locksmith_service import LocksmithService
from sqlalchemy.orm import selectinload
from app.schemas.request_session import (
    RequestSessionCreate,
    LocationValidation,
    LocationValidationResponse,
    ServiceSelection,
    ServiceSelectionResponse,
    PaymentIntent,
    RequestSessionResponse,
)

router = APIRouter(prefix="/api/request", tags=["customer"])
settings = get_settings()


@router.post("/start", response_model=RequestSessionResponse)
async def start_request(
    request: Request,
    db: DbSession,
    data: RequestSessionCreate | None = None,
):
    """
    Start a new service request session.
    
    This begins the 3-step customer flow.
    No authentication required.
    """
    session = RequestSession(
        status=SessionStatus.STARTED,
        step_reached=1,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        referrer=request.headers.get("referer"),
        utm_params=data.utm_params if data else None,
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    return RequestSessionResponse.model_validate(session)


@router.post("/{session_id}/location", response_model=LocationValidationResponse)
async def validate_location(
    session_id: UUID,
    data: LocationValidation,
    db: DbSession,
):
    """
    Step 1: Validate customer info and location.

    Checks if the address is within our service areas.
    Supports both address entry and pin drop (reverse geocoding).
    """
    import logging
    logger = logging.getLogger(__name__)

    # Get session
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update session with customer info
    session.customer_name = data.customer_name
    session.customer_phone = data.customer_phone
    session.customer_email = data.customer_email

    # Validate location using Google Maps
    city = None
    address = data.address
    latitude = data.latitude
    longitude = data.longitude
    is_in_service_area = False

    try:
        if not settings.google_maps_api_key:
            raise ValueError("Google Maps API key not configured")

        gmaps = googlemaps.Client(key=settings.google_maps_api_key)

        if data.location_method == "pin" and latitude is not None and longitude is not None:
            # Reverse geocode from coordinates
            reverse_result = gmaps.reverse_geocode((latitude, longitude))

            if reverse_result:
                # Get formatted address from reverse geocode
                address = reverse_result[0].get("formatted_address", "")

                # Extract city from address components
                for component in reverse_result[0].get("address_components", []):
                    if "locality" in component.get("types", []):
                        city = component["long_name"]
                        break
        else:
            # Forward geocode from address
            geocode_result = gmaps.geocode(address)

            if geocode_result:
                # Extract coordinates from geocode result
                location = geocode_result[0].get("geometry", {}).get("location", {})
                latitude = location.get("lat")
                longitude = location.get("lng")

                # Extract city from address components
                for component in geocode_result[0].get("address_components", []):
                    if "locality" in component.get("types", []):
                        city = component["long_name"]
                        break

        # Check if city is in service areas (case-insensitive)
        if city:
            city_normalized = city.strip()
            service_areas_normalized = [area.strip() for area in settings.service_areas]

            if city_normalized in service_areas_normalized:
                is_in_service_area = True

    except Exception as e:
        logger.error(f"Geocoding error: {str(e)}")

        # In development mode, if geocoding fails, accept any location for testing
        if settings.app_env == "development":
            city = "Laredo"  # Default for testing
            is_in_service_area = True
            if data.location_method == "pin" and latitude and longitude:
                address = f"Pin at {latitude:.6f}, {longitude:.6f}"

    # Update session with location data
    session.address = address
    session.city = city
    session.latitude = latitude
    session.longitude = longitude
    session.is_in_service_area = is_in_service_area

    if is_in_service_area:
        session.status = SessionStatus.LOCATION_VALIDATED
    else:
        session.status = SessionStatus.LOCATION_REJECTED

    await db.commit()

    message = None
    if not is_in_service_area:
        message = "Sorry, we don't currently service your area. We're expanding soon!"

    return LocationValidationResponse(
        session_id=session_id,
        is_in_service_area=is_in_service_area,
        city=city,
        address=address,
        latitude=latitude,
        longitude=longitude,
        message=message,
    )


@router.post("/{session_id}/service", response_model=ServiceSelectionResponse)
async def select_service(
    session_id: UUID,
    data: ServiceSelection,
    background_tasks: BackgroundTasks,
    db: DbSession,
    sms_service: SMSServiceDep,
):
    """
    Step 2: Select service type and urgency.
    
    Sends SMS to all available locksmiths asking for quotes.
    Sets status to PENDING_APPROVAL.
    """
    # Get session
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != SessionStatus.LOCATION_VALIDATED:
        raise HTTPException(
            status_code=400,
            detail="Location must be validated first",
        )

    # Get deposit amount for service type
    deposit_amount = settings.deposit_amounts.get(data.service_type, 4900)
    
    # Apply emergency surcharge if applicable
    if data.urgency == "emergency":
        deposit_amount = int(deposit_amount * 1.5)

    # Update session
    session.service_type = data.service_type
    session.urgency = data.urgency
    session.description = data.description
    session.deposit_amount = deposit_amount
    session.step_reached = 2
    session.status = SessionStatus.PENDING_APPROVAL
    
    # Store car details if provided
    if data.service_type == "car_lockout":
        session.car_make = data.car_make
        session.car_model = data.car_model
        session.car_year = data.car_year

    await db.commit()

    # Find available locksmiths and send SMS in background
    locksmith_service = LocksmithService(db)
    available_locksmiths = await locksmith_service.find_available_for_job(
        city=session.city or "",
        service_type=data.service_type,
        exclude_ids=None,  # No exclusions for initial request
        limit=100,  # Get all available locksmiths
    )

    # Log for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Searching for locksmiths: city='{session.city}', service_type='{data.service_type}'")
    logger.info(f"Found {len(available_locksmiths)} locksmiths")
    
    if not available_locksmiths:
        logger.warning(f"⚠️ NO LOCKSMITHS FOUND!")
        logger.warning(f"   City searched: '{session.city}'")
        logger.warning(f"   Service type: '{data.service_type}'")
        logger.warning(f"   Check: locksmith.primary_city must match exactly (case-sensitive)")
        logger.warning(f"   Check: locksmith.supports_{data.service_type} must be true")
        logger.warning(f"   Check: locksmith.is_active and is_available must both be true")
        
        # Try to find all locksmiths in database for debugging
        all_locksmiths_result = await db.execute(
            select(Locksmith)
        )
        all_locksmiths = all_locksmiths_result.scalars().all()
        logger.info(f"   Total locksmiths in database: {len(all_locksmiths)}")
        for ls in all_locksmiths:
            logger.info(f"   - {ls.display_name}: city='{ls.primary_city}', active={ls.is_active}, available={ls.is_available}, "
                       f"home={ls.supports_home_lockout}, car={ls.supports_car_lockout}, rekey={ls.supports_rekey}, smart={ls.supports_smart_lock}")

    # Send SMS to all locksmiths and create offer records
    service_names = {
        "home_lockout": "Home Lockout",
        "car_lockout": "Car Lockout",
        "rekey": "Lock Rekey",
        "smart_lock": "Smart Lock Install",
    }
    service_name = service_names.get(data.service_type, data.service_type)
    
    urgency_text = "EMERGENCY" if data.urgency == "emergency" else "Standard"
    
    # Build message with request details
    message_parts = [
        f"New {service_name} request - {urgency_text}",
        f"Location: {session.address}",
    ]
    
    if data.service_type == "car_lockout" and session.car_make:
        message_parts.append(f"Vehicle: {session.car_make} {session.car_model} {session.car_year}")
    
    if session.description:
        message_parts.append(f"Details: {session.description}")
    
    message_parts.append("Reply like this: Y $100 to quote, or N to decline")
    
    message = "\n".join(message_parts)

    # Create offer records and send SMS
    for locksmith in available_locksmiths:
        try:
            # Create offer record
            offer = JobOffer(
                request_session_id=session_id,
                locksmith_id=locksmith.id,
                wave_number=1,
                status=OfferStatus.PENDING,
            )
            db.add(offer)
            await db.flush()

            # Log SMS attempt
            logger.info(f"Sending SMS to locksmith {locksmith.display_name} at {locksmith.phone}")

            # Send SMS
            message_sid = await sms_service.send_sms(
                to_phone=locksmith.phone,
                body=message,
                locksmith_id=locksmith.id,
            )
            offer.twilio_message_sid = message_sid
            
            logger.info(f"SMS sent to {locksmith.phone}, message_sid: {message_sid}")

        except Exception as e:
            logger.error(f"Failed to send offer to locksmith {locksmith.id} ({locksmith.display_name}): {str(e)}", exc_info=True)

    await db.commit()

    return ServiceSelectionResponse(
        session_id=session_id,
        deposit_amount=deposit_amount,
        deposit_display=f"${deposit_amount / 100:.2f}",
        service_type=data.service_type,
        urgency=data.urgency,
    )


@router.post("/{session_id}/photo")
async def upload_photo(
    session_id: UUID,
    db: DbSession,
    s3_service: S3ServiceDep,
    photo: UploadFile = File(...),
):
    """
    Upload a photo for the request session.
    
    Uploads to S3 and stores metadata in database.
    """
    # Get session
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file content
    file_content = await photo.read()
    file_size = len(file_content)

    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    # Generate Photo ID first (will be used as S3 filename UUID)
    photo_id = uuid.uuid4()
    
    # Upload to S3 if configured
    s3_bucket = None
    if s3_service.is_configured():
        try:
            s3_bucket, _ = s3_service.upload_photo(
                photo_id=photo_id,
                file_content=file_content,
                content_type=photo.content_type,
                session_id=session_id,
            )
        except ValueError as e:
            # Log error but don't fail - store metadata anyway
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"S3 upload failed: {str(e)}")
            # In development, allow continuing without S3
            if settings.app_env != "development":
                raise HTTPException(status_code=500, detail="Failed to upload photo to storage")
    else:
        # S3 not configured - log warning
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("S3 not configured - photo metadata saved but file not stored")
        if settings.app_env != "development":
            raise HTTPException(status_code=500, detail="Photo storage not configured")

    # Create photo record with pre-generated ID
    photo_record = Photo(
        id=photo_id,  # Use the same ID as S3 filename
        request_session_id=session_id,
        source="web_upload",
        content_type=photo.content_type,
        bytes=file_size,
        s3_bucket=s3_bucket,
    )

    db.add(photo_record)
    await db.commit()
    await db.refresh(photo_record)

    return {"photo_id": str(photo_record.id), "message": "Photo uploaded successfully"}


@router.post("/{session_id}/payment-intent", response_model=PaymentIntent)
async def create_payment_intent(
    session_id: UUID,
    db: DbSession,
    payment_service: PaymentServiceDep,
):
    """
    Step 3: Create a payment intent for the deposit.
    
    Returns Stripe client_secret for frontend payment form.
    """
    # Get session
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Allow payment when customer has selected service (SERVICE_SELECTED) or is viewing quotes (PENDING_APPROVAL)
    if session.status not in (SessionStatus.SERVICE_SELECTED, SessionStatus.PENDING_APPROVAL):
        raise HTTPException(
            status_code=400,
            detail="Service must be selected first",
        )

    if not session.deposit_amount:
        raise HTTPException(status_code=400, detail="Deposit amount not set")

    # In development mode without Stripe, create a dummy payment intent
    if settings.app_env == "development" and not settings.stripe_secret_key:
        payment_data = {
            "client_secret": "dev_secret",
            "payment_intent_id": f"dev_pi_{session_id}",
            "amount": session.deposit_amount,
        }
        session.stripe_payment_intent_id = payment_data["payment_intent_id"]
    else:
        # Create Stripe payment intent
        payment_data = await payment_service.create_payment_intent(
            session_id=session_id,
            amount=session.deposit_amount,
        )
        session.stripe_payment_intent_id = payment_data["payment_intent_id"]

    session.status = SessionStatus.PAYMENT_PENDING
    session.step_reached = 3
    await db.commit()

    return PaymentIntent(
        session_id=session_id,
        client_secret=payment_data["client_secret"],
        payment_intent_id=payment_data["payment_intent_id"],
        amount=payment_data["amount"],
        amount_display=f"${payment_data['amount'] / 100:.2f}",
    )


@router.post("/{session_id}/complete")
async def complete_request(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    db: DbSession,
    payment_service: PaymentServiceDep,
    dispatch_service: DispatchServiceDep,
    sms_service: SMSServiceDep,
):
    """
    Complete the request after successful payment.
    
    Creates the job and starts dispatch.
    """
    # Get session
    result = await db.execute(
        select(RequestSession).where(RequestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Allow SERVICE_SELECTED status in development (skip payment step)
    if session.status not in [SessionStatus.PAYMENT_PENDING, SessionStatus.SERVICE_SELECTED]:
        raise HTTPException(status_code=400, detail="Invalid session status")

    # In development mode without Stripe, skip payment verification
    if settings.app_env == "development" and not settings.stripe_secret_key:
        # Create a dummy payment intent ID if not set
        if not session.stripe_payment_intent_id:
            session.stripe_payment_intent_id = f"dev_pi_{session.id}"
            await db.commit()
    else:
        # Production: require payment verification
        if not session.stripe_payment_intent_id:
            raise HTTPException(status_code=400, detail="No payment intent found")

        # Verify payment succeeded
        payment_verified = await payment_service.confirm_payment(
            session.stripe_payment_intent_id
        )
        if not payment_verified:
            raise HTTPException(status_code=400, detail="Payment not confirmed")

    # Create job from session
    job_service = JobService(db)
    job = await job_service.create_from_session(
        session=session,
        stripe_payment_intent_id=session.stripe_payment_intent_id,
        car_make=session.car_make,
        car_model=session.car_model,
        car_year=session.car_year,
    )

    # Send confirmation SMS to customer (don't fail if SMS fails)
    try:
        await sms_service.send_customer_confirmation(job.id, job.customer_phone)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to send confirmation SMS: {str(e)}")

    # Start dispatch in background
    background_tasks.add_task(dispatch_service.start_dispatch, job.id)

    return {
        "success": True,
        "job_id": str(job.id),
        "message": "Your request has been submitted! A locksmith will contact you shortly.",
    }


@router.get("/{session_id}", response_model=RequestSessionResponse)
async def get_session_status(
    session_id: UUID,
    db: DbSession,
):
    """Get current session status."""
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


def _safe_offer_for_json(offer: JobOffer) -> dict:
    """Build a JSON-serializable dict for one offer, defensive against missing/bad data."""
    # status can be Enum (from ORM) or plain str (from DB); never use .value on str
    raw = getattr(offer, "status", None)
    status_str = getattr(raw, "value", None) if raw is not None else None
    if status_str is None:
        status_str = str(raw) if raw is not None else "unknown"
    quoted = offer.quoted_price
    quoted_display = f"${quoted / 100:.2f}" if quoted is not None else None
    try:
        sent_at_str = offer.sent_at.isoformat() if offer.sent_at else None
    except Exception:
        sent_at_str = None
    try:
        responded_at_str = offer.responded_at.isoformat() if offer.responded_at else None
    except Exception:
        responded_at_str = None
    locksmith_name = "Unknown"
    locksmith_phone = None
    if offer.locksmith:
        locksmith_name = getattr(offer.locksmith, "display_name", "Unknown") or "Unknown"
        locksmith_phone = getattr(offer.locksmith, "phone", None)
    return {
        "id": str(offer.id),
        "locksmith_name": locksmith_name,
        "locksmith_phone": locksmith_phone,
        "status": status_str,
        "quoted_price": quoted,
        "quoted_price_display": quoted_display,
        "sent_at": sent_at_str,
        "responded_at": responded_at_str,
    }


@router.get("/{session_id}/offers")
async def get_session_offers(
    session_id: UUID,
    db: DbSession,
):
    """Get all job offers for a request session."""
    logger = logging.getLogger(__name__)
    try:
        # Verify session exists
        result = await db.execute(
            select(RequestSession).where(RequestSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get all offers for this session with locksmith info
        offers_result = await db.execute(
            select(JobOffer)
            .where(JobOffer.request_session_id == session_id)
            .options(selectinload(JobOffer.locksmith))
            .order_by(JobOffer.sent_at.desc())
        )
        offers = offers_result.scalars().all()

        offers_data = [_safe_offer_for_json(offer) for offer in offers]
        accepted_count = len([o for o in offers_data if o.get("status") == "accepted"])

        return {
            "session_id": str(session_id),
            "offers": offers_data,
            "total_offers": len(offers_data),
            "accepted_offers": accepted_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_session_offers failed for session_id=%s: %s", session_id, e)
        raise
