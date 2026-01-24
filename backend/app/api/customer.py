"""Customer API routes - public, no authentication required."""

from uuid import UUID
import uuid
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import googlemaps

from app.api.deps import DbSession, PaymentServiceDep, DispatchServiceDep, SMSServiceDep, S3ServiceDep
from app.config import get_settings
from app.models.request_session import RequestSession, SessionStatus
from app.models.job import Job
from app.models.photo import Photo
from app.services.job_service import JobService
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
    """
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
    session.address = data.address

    # Validate address using Google Maps
    city = None
    is_in_service_area = False
    
    # Try to geocode the address
    try:
        if not settings.google_maps_api_key:
            raise ValueError("Google Maps API key not configured")
        
        gmaps = googlemaps.Client(key=settings.google_maps_api_key)
        geocode_result = gmaps.geocode(data.address)
        
        if geocode_result:
            # Extract city from address components
            for component in geocode_result[0].get("address_components", []):
                if "locality" in component.get("types", []):
                    city = component["long_name"]
                    break

            # Check if city is in service areas (case-insensitive)
            if city:
                # Normalize for comparison
                city_normalized = city.strip()
                service_areas_normalized = [area.strip() for area in settings.service_areas]
                
                if city_normalized in service_areas_normalized:
                    is_in_service_area = True

    except Exception as e:
        # Log error but don't expose to user
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Geocoding error: {str(e)}")
        
        # In development mode, if geocoding fails, accept any address for testing
        if settings.app_env == "development":
            city = "Laredo"  # Default for testing
            is_in_service_area = True
        # Otherwise, geocoding failure means not in service area

    session.city = city
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
        message=message,
    )


@router.post("/{session_id}/service", response_model=ServiceSelectionResponse)
async def select_service(
    session_id: UUID,
    data: ServiceSelection,
    db: DbSession,
):
    """
    Step 2: Select service type and urgency.
    
    Returns the deposit amount for payment.
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
    session.status = SessionStatus.SERVICE_SELECTED
    
    # Store car details if provided
    if data.service_type == "car_lockout":
        session.car_make = data.car_make
        session.car_model = data.car_model
        session.car_year = data.car_year

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

    if session.status != SessionStatus.SERVICE_SELECTED:
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
