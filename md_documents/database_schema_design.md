# Database Schema Design Documentation

## Overview

The locksmith marketplace database uses a **two-phase booking flow** architecture that separates the pre-payment customer funnel from post-payment job execution. This design enables abandoned cart analysis, fraud detection, and funnel optimization while maintaining clean separation of concerns.

---

## Core Architecture: Two-Phase Booking Flow

The schema separates customer journey tracking from actual service execution:

1. **RequestSession** - Tracks customer progress through the booking funnel (before payment)
2. **Job** - Created after payment, represents the actual service request

**Why this separation?**
- Enables abandoned cart analysis without cluttering the job table
- Allows fraud detection before payment
- Supports funnel optimization and A/B testing
- Keeps job table clean with only completed bookings

---

## Table-by-Table Design Choices

### 1. `locksmiths` Table

**Purpose:** Service providers in the marketplace

**Key Design Choices:**
- **Phone as unique identifier** - No email/password authentication; SMS-only MVP
- **Boolean service flags** - Simple capability model (`supports_home_lockout`, `supports_car_lockout`, etc.)
- **`primary_city`** - Single city for dispatch matching (no multi-city support in MVP)
- **`is_active` vs `is_available`** - Separate admin control from real-time availability
- **No location coordinates** - City-based matching only (can add later)

**Rationale:** Minimal MVP design focused on core functionality. Can easily add coordinates, ratings, etc. later.

**Indexes:**
- `phone` (unique) - Fast lookup by phone number
- `primary_city` - Geographic filtering
- `is_active` - Filter active locksmiths
- `is_available` - Filter available locksmiths

---

### 2. `request_sessions` Table

**Purpose:** Tracks customer progress through the booking funnel before payment

**Key Design Choices:**
- **All fields nullable** - Data collected incrementally (step 1 → step 2 → step 3)
- **`step_reached`** - Integer tracking funnel progress (1-3)
- **`status` enum** - State machine for session lifecycle
- **`utm_params` (JSONB)** - Marketing attribution data
- **Tracking fields** - `user_agent`, `ip_address`, `referrer` for fraud/analytics
- **Car fields nullable** - Only used for `car_lockout` service type

**Status Flow:**
```
STARTED → LOCATION_VALIDATED → SERVICE_SELECTED → PAYMENT_PENDING → PAYMENT_COMPLETED
         └─ LOCATION_REJECTED (rejected path)
         └─ ABANDONED (user left)
```

**Rationale:** 
- Enables abandoned cart analysis
- Supports fraud detection
- Tracks marketing attribution
- Debugging customer issues

**Indexes:**
- `status` - Filter by session state
- `customer_phone` - Lookup customer sessions
- `step_reached` - Funnel analysis

---

### 3. `jobs` Table

**Purpose:** Actual service requests created after payment is captured

**Key Design Choices:**
- **Separate from RequestSession** - Created only after payment succeeds
- **Customer identified by phone** - No user accounts (phone-based identification)
- **`status` enum** - Clear lifecycle states (CREATED → DISPATCHING → ASSIGNED → COMPLETED)
- **`deposit_amount` in cents** - Avoids float precision issues
- **`latitude`/`longitude` nullable** - Geocoding optional (can add later)
- **`current_wave`** - Tracks which dispatch wave (for wave-based dispatch)
- **`request_session_id`** - Links back to original session
- **Car fields nullable** - Only populated for `car_lockout` service type

**Status Flow:**
```
CREATED → DISPATCHING → OFFERED → ASSIGNED → EN_ROUTE → COMPLETED
         └─ FAILED (no locksmith accepted)
         └─ CANCELED (admin/customer canceled)
```

**Rationale:**
- Immutable record after creation
- Complete payment tracking
- Dispatch workflow support
- Links to original session for analytics

**Indexes:**
- `status` - Filter by job state
- `customer_phone` - Customer lookup
- `service_type` - Service filtering
- `city` - Geographic filtering
- `assigned_locksmith_id` - Locksmith job list

---

### 4. `job_offers` Table

**Purpose:** Tracks dispatch offers sent to locksmiths (wave-based dispatch)

**Key Design Choices:**
- **Separate table** - One job can have many offers (wave-based dispatch)
- **`wave_number`** - Tracks which dispatch wave (1, 2, 3...)
- **`status` enum** - PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELED
- **`twilio_message_sid`** - Links to SMS sent
- **`expires_at`** - Timeout for offers

**Rationale:**
- Supports multiple offers per job (wave-based dispatch)
- Tracks dispatch history
- Enables analytics on acceptance rates
- Links to SMS for audit trail

**Indexes:**
- `job_id` - Find all offers for a job
- `locksmith_id` - Find all offers to a locksmith
- `status` - Filter by offer state

---

### 5. `messages` Table

**Purpose:** Complete SMS audit trail for compliance and debugging

**Key Design Choices:**
- **Audit trail** - Every SMS sent or received is logged
- **`direction` enum** - INBOUND/OUTBOUND
- **`job_id` nullable** - Some messages not job-specific (e.g., availability commands)
- **Twilio metadata** - `provider_message_id`, `delivery_status`, `error_code`
- **Full message body stored** - For disputes/debugging

**Rationale:**
- Compliance requirements
- Debugging delivery issues
- Dispute resolution
- Complete communication history

**Indexes:**
- `job_id` - Find all messages for a job
- `locksmith_id` - Find all messages with a locksmith
- `direction` - Filter inbound vs outbound
- `created_at` - Time-based queries

---

### 6. `photos` Table

**Purpose:** Stores metadata for uploaded images (web uploads or Twilio MMS)

**Key Design Choices:**
- **Dual linkage** - Can link to `job_id` OR `request_session_id`
- **`source` field** - "web_upload" vs "twilio_mms"
- **S3 storage fields** - `s3_bucket`, `s3_key` (not storing files in DB)
- **Twilio metadata** - For MMS photos (`twilio_message_sid`, `twilio_media_sid`)
- **CASCADE delete** - Photos deleted with job/session

**Rationale:**
- Supports both upload paths (web and SMS)
- External file storage (S3) keeps DB lean
- Maintains metadata for admin UI
- Flexible linkage (before or after payment)

**Indexes:**
- `job_id` - Find photos for a job
- `request_session_id` - Find photos for a session

**Storage Strategy:**
- Files stored in S3 (private bucket)
- Database stores S3 location only
- Admin UI uses presigned URLs for access

---

### 7. `audit_events` Table

**Purpose:** Generic audit log for all significant system events

**Key Design Choices:**
- **Generic entity tracking** - `entity_type` + `entity_id` (polymorphic)
- **`payload_json` (JSONB)** - Flexible event data
- **`actor_email`** - From Cloudflare Access header
- **`actor_type`** - system/admin/locksmith
- **Indexed on multiple fields** - Fast queries

**Rationale:**
- Centralized audit log
- Compliance requirements
- Debugging system changes
- Accountability tracking

**Indexes:**
- `entity_type` + `entity_id` - Find events for specific entity
- `event_type` - Filter by event type
- `actor_email` - Find actions by admin
- `created_at` - Time-based queries

---

## Key Design Patterns

### 1. UUID Primary Keys
**Why:** 
- Distributed-friendly (no sequence conflicts)
- Non-sequential (harder to enumerate)
- Better for security

**Trade-off:** Slightly larger than integers, but worth it for security

### 2. Timezone-Aware Timestamps
**Why:** 
- Consistent UTC storage
- Display in user timezone
- No ambiguity

**All timestamps:** `DateTime(timezone=True)`

### 3. Money Stored as Integers (Cents)
**Why:** 
- Avoids float precision issues
- Exact calculations
- Industry standard

**Fields:** `deposit_amount`, `refund_amount` stored in cents

### 4. Status Enums as Strings
**Why:** 
- Readable in database
- Easy to query
- Extensible

**Stored as:** `String(50)` with enum classes in code

### 5. Indexing Strategy
- **Foreign keys indexed** - Faster joins
- **Status fields indexed** - Common filters
- **Phone numbers indexed** - Lookup by customer
- **City indexed** - Geographic filtering
- **Composite indexes** where needed

### 6. Nullable vs Required
- **RequestSession:** Mostly nullable (incremental collection)
- **Job:** Mostly required (immutable after creation)
- **Photos:** Flexible linkage (job OR session)

### 7. CASCADE Deletes
- Photos cascade with job/session
- JobOffers cascade with job
- Messages cascade with job

**Why:** Prevents orphaned records

---

## Data Flow

### Complete Customer Booking Flow

#### Step 1: Session Start & Location Validation
```
1. Customer visits /request page
   → POST /api/request/start
   → RequestSession created (status: STARTED, step_reached: 1)
   → Returns session_id

2. Customer enters name, phone, email, address
   → POST /api/request/{session_id}/location
   → Backend geocodes address via Google Maps
   → Checks if city is in service_areas list
   → RequestSession updated:
     - customer_name, customer_phone, customer_email, address
     - city, is_in_service_area
     - status: LOCATION_VALIDATED (if in area) or LOCATION_REJECTED
     - step_reached: 1
```

#### Step 2: Service Selection
```
3. Customer selects service type and urgency
   → If home_lockout: Photo upload required
     → POST /api/request/{session_id}/photo
     → Photo record created (linked to request_session_id)
     → File stored (currently metadata only, S3 upload pending)
   
   → If car_lockout: Car details required
     → car_make, car_model, car_year validated
   
   → POST /api/request/{session_id}/service
   → RequestSession updated:
     - service_type, urgency, description
     - car_make, car_model, car_year (if car_lockout)
     - deposit_amount calculated (with emergency surcharge if applicable)
     - status: SERVICE_SELECTED
     - step_reached: 2
```

#### Step 3: Payment
```
4. Customer proceeds to payment
   → POST /api/request/{session_id}/payment-intent
   → Stripe PaymentIntent created (or dev mode dummy)
   → RequestSession updated:
     - stripe_payment_intent_id
     - status: PAYMENT_PENDING
     - step_reached: 3
   
5. Customer completes payment (Stripe webhook or direct)
   → POST /api/request/{session_id}/complete
   → Payment verified
   → Job created from RequestSession:
     - All customer info copied
     - Service details copied
     - Car details copied (if applicable)
     - Payment info copied
   → RequestSession updated:
     - status: PAYMENT_COMPLETED
     - completed_at: now()
   → Photos linked to Job (if any)
   → SMS confirmation sent to customer
   → Dispatch started in background
```

---

### Job Lifecycle & Dispatch Flow

#### Job Creation & Dispatch Start
```
Job created (status: CREATED)
  → Background task: dispatch_service.start_dispatch(job_id)
  → Job status: DISPATCHING
  → Job.dispatch_started_at: now()
  → Job.current_wave: 0
```

#### Wave-Based Dispatch Process
```
Wave 1:
  → Find available locksmiths (city match, service type match, not previously contacted)
  → Limit: 3 locksmiths (dispatch_wave_size)
  → For each locksmith:
    1. Create JobOffer (status: PENDING, wave_number: 1)
    2. Send SMS via Twilio
    3. Store twilio_message_sid in JobOffer
    4. Set expires_at (now + 2 minutes)
  → Job status: OFFERED
  → Job.current_wave: 1
  → Wait 2 minutes (dispatch_wave_delay_seconds)

Locksmith Response (via SMS):
  → Twilio webhook: POST /api/webhooks/twilio/sms
  → Parse locksmith phone and response (YES/NO)
  → Find pending JobOffer for that locksmith
  
  If YES:
    → Redis lock acquired (prevents race condition)
    → JobOffer status: ACCEPTED
    → Job.assigned_locksmith_id: locksmith.id
    → Job.assigned_at: now()
    → Job.status: ASSIGNED
    → All other pending JobOffers: CANCELED
    → SMS confirmation to locksmith
    → SMS notification to customer
    → Redis lock released
  
  If NO:
    → JobOffer status: DECLINED
    → Check if all offers in wave declined
    → If all declined → Send next wave (or fail if no more locksmiths)

Wave 2 (if no acceptance in Wave 1):
  → Exclude locksmiths already contacted
  → Find next 3 available locksmiths
  → Create JobOffer records (wave_number: 2)
  → Send SMS offers
  → Wait 2 minutes
  → Repeat until assigned or failed

Job Failure:
  → If no locksmiths available or all declined
  → Job.status: FAILED
  → SMS to customer: Refund notification
  → Refund processed (manual or automated)
```

#### Job Completion
```
Job assigned (status: ASSIGNED)
  → Locksmith arrives (manual update or status change)
  → Job.status: EN_ROUTE (optional intermediate state)
  → Job.status: COMPLETED
  → Job.completed_at: now()
  → Final payment processed (if applicable)
```

---

### Photo Upload Flow

#### Web Upload (Home Lockout)
```
1. Customer selects photo in form
   → File validated (image type, size)
   → POST /api/request/{session_id}/photo (multipart/form-data)
   → Photo record created:
     - request_session_id: session_id
     - source: "web_upload"
     - content_type: from file
     - bytes: file size
     - s3_bucket: null (pending S3 implementation)
     - s3_key: null (pending S3 implementation)
   → TODO: Upload file to S3, store s3_bucket and s3_key

2. After payment completes
   → Photos linked to Job:
     - Photo.job_id: job.id
     - Photo.request_session_id: kept for history
```

#### SMS Upload (Future - Twilio MMS)
```
1. Customer receives SMS: "Reply with photo of your lock"
   → Customer replies with MMS image
   → Twilio webhook: POST /api/webhooks/twilio/mms
   → Download image from Twilio MediaUrl
   → Upload to S3
   → Photo record created:
     - job_id or request_session_id
     - source: "twilio_mms"
     - twilio_message_sid, twilio_media_sid
     - s3_bucket, s3_key
```

---

### Message Flow (SMS Audit Trail)

#### Outbound Messages
```
System sends SMS:
  → sms_service.send_sms()
  → Message record created:
     - direction: OUTBOUND
     - to_phone, from_phone
     - body: message text
     - job_id: if job-related
     - locksmith_id: if to locksmith
     - provider_message_id: Twilio MessageSid
     - delivery_status: pending
  → SMS sent via Twilio
  → Twilio webhook updates delivery_status
```

#### Inbound Messages
```
Locksmith sends SMS:
  → Twilio webhook: POST /api/webhooks/twilio/sms
  → Message record created:
     - direction: INBOUND
     - to_phone, from_phone
     - body: message text
     - job_id: if job-related
     - locksmith_id: identified by phone
     - provider_message_id: Twilio MessageSid
  → Command processed (YES/NO/AVAILABLE/etc.)
  → Response sent (creates outbound message)
```

---

### State Transition Diagrams

#### RequestSession States
```
STARTED
  ↓ (location validated)
LOCATION_VALIDATED
  ↓ (service selected)
SERVICE_SELECTED
  ↓ (payment intent created)
PAYMENT_PENDING
  ↓ (payment completed)
PAYMENT_COMPLETED
  └─ Job created

STARTED
  ↓ (location rejected)
LOCATION_REJECTED
  └─ End (no job created)

Any state
  ↓ (user abandons)
ABANDONED
```

#### Job States
```
CREATED
  ↓ (dispatch starts)
DISPATCHING
  ↓ (offers sent)
OFFERED
  ↓ (locksmith accepts)
ASSIGNED
  ↓ (optional)
EN_ROUTE
  ↓ (job finished)
COMPLETED

OFFERED
  ↓ (no acceptance, no more locksmiths)
FAILED

Any state
  ↓ (admin/customer cancels)
CANCELED
```

#### JobOffer States
```
PENDING
  ↓ (locksmith replies YES)
ACCEPTED
  └─ Job assigned

PENDING
  ↓ (locksmith replies NO)
DECLINED
  └─ Next wave or fail

PENDING
  ↓ (timeout)
EXPIRED
  └─ Next wave or fail

PENDING
  ↓ (job assigned to someone else)
CANCELED
```

---

### Database Write Patterns

#### High Write Volume
- **Messages table** - Every SMS (inbound + outbound)
- **JobOffers table** - Multiple offers per job (wave-based)
- **AuditEvents table** - All significant system events

#### Medium Write Volume
- **RequestSessions table** - Every customer visit
- **Jobs table** - After payment only

#### Low Write Volume
- **Locksmiths table** - Admin-managed
- **Photos table** - One per home lockout request

---

### Read Patterns & Query Optimization

#### Common Queries
1. **Find available locksmiths for job**
   - Filter: `city`, `service_type`, `is_active=True`, `is_available=True`
   - Exclude: Already contacted (from JobOffers)
   - Indexes: `primary_city`, service flags

2. **Get job details with offers**
   - Join: Job → JobOffers → Locksmith
   - Indexes: `job_id` on JobOffers, `locksmith_id` on JobOffers

3. **Customer job history**
   - Filter: `customer_phone`
   - Index: `customer_phone` on Jobs

4. **Abandoned cart analysis**
   - Filter: `status != PAYMENT_COMPLETED`, `created_at` range
   - Index: `status`, `created_at` on RequestSessions

5. **Admin dashboard queries**
   - Jobs by status, city, date range
   - Indexes: `status`, `city`, `created_at` on Jobs

---

## Relationships

```
Locksmith (1) ──< (many) JobOffer
Locksmith (1) ──< (many) Job (assigned)
Locksmith (1) ──< (many) Message

RequestSession (1) ──< (1) Job
RequestSession (1) ──< (many) Photo

Job (1) ──< (many) JobOffer
Job (1) ──< (many) Message
Job (1) ──< (many) Photo
```

---

## Trade-offs and Future Considerations

### Current Limitations (By Design)
1. **Single city per locksmith** - No multi-city support
2. **No customer accounts** - Phone-based identification only
3. **No ratings/reviews** - MVP focus
4. **Simple dispatch** - Wave-based, no real-time matching
5. **No pricing tiers** - Fixed deposit amounts

### Easy to Extend
- Add coordinates to locksmiths for distance-based matching
- Add customer table if accounts needed
- Add ratings table
- Add pricing rules table
- Add service area polygons

---

## Migration History

### Migration 001: Initial Schema
- Created core tables: locksmiths, request_sessions, jobs, job_offers, messages, audit_events
- Established relationships and indexes
- Set up status enums

### Migration 002: Photos and Car Fields
- Added `photos` table for image storage
- Added car fields (`car_make`, `car_model`, `car_year`) to both `jobs` and `request_sessions`
- Supports home lockout photos and car lockout details

---

## Summary

The schema prioritizes:
1. **Simplicity** - MVP-focused, no over-engineering
2. **Auditability** - Complete trails for compliance
3. **Flexibility** - Nullable fields, JSONB for extensibility
4. **Performance** - Strategic indexing
5. **Data Integrity** - Foreign keys, enums, cascades

This design supports the current workflow while leaving room for future enhancements without major migrations.
