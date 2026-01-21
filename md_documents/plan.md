# Locksmith Marketplace — Agentic Build Spec (Admin-First, Manual Ops)

## Objective
Build an MVP for an on-demand locksmith marketplace that is **admin-operated first**.

The system must allow:
- Customers to submit multi-step service requests and pay a deposit
- Admins to monitor and control all jobs end-to-end
- Locksmiths to be onboarded manually by admins
- Dispatch to occur via SMS in controlled waves
- Locksmiths to accept/reject jobs via SMS
- Atomic assignment of the first accepting locksmith
- Full visibility into order history, progress, and messaging

This MVP prioritizes **operational control, trust, and reliability over automation**.

---

## Core Product Surfaces (Very Important)

1. **Customer Web Flow (No Authentication)**
2. **Admin Console (Primary Control Plane, Network-Gated)**
3. **SMS Interface for Locksmiths**

There is **no locksmith app** in v1.

---

## Explicit Auth Model (Important)

- **Customers:**  
  - No accounts  
  - No JWT  
  - Identified only by phone number and request session

- **Admins:**  
  - No in-app authentication
  - Admin UI and Admin APIs are protected **at the network edge** using **Cloudflare Access**
  - If a request reaches `/admin/*` or `/api/admin/*`, it is trusted

- **Locksmiths:**  
  - Identified by phone number only
  - Interact exclusively via SMS in MVP

---

## Non-Goals
- No native mobile apps
- No self-serve locksmith signup
- No automated nationwide rollout
- No complex pricing or ML dispatch
- No Stripe Connect payouts initially
- No role-based auth or permissions system

---

## Tech Stack (Locked)

### Frontend
- Next.js (React + TypeScript)
- TailwindCSS
- React Hook Form + Zod

### Backend
- **Python 3.13**
- **FastAPI**
- APIRouter-based routing
- Dependency-injected services
- Async-first endpoints
- Background workers for dispatch

### Database
- PostgreSQL
- UUID primary keys
- JSON-friendly columns where appropriate

### ORM
- **SQLAlchemy 2.x (Declarative)**
- Relationships
- Enum-backed status fields

### Migrations
- **Alembic**
- Schema evolution tracked in git

### Cache / Locks
- Redis
  - Assignment locks
  - Dispatch wave coordination
  - Idempotency

### Messaging
- Twilio SMS
  - Outbound offers and notifications
  - Inbound YES/NO/AVAILABLE commands

### Payments
- Stripe
  - PaymentIntents for deposit capture
  - Refunds
  - Webhooks as source of truth

### Maps
- Google Maps
  - Places Autocomplete
  - Geocoding
  - Distance checks

### Hosting / Infra
- Frontend: Vercel
- Backend: ASGI (Uvicorn)
- DB: Managed Postgres
- Cache: Managed Redis
- Files: S3 (optional)

---

## Admin Access Control (Network-Gated)

- Admin UI routes:
  - `/admin/*`
- Admin API routes:
  - `/api/admin/*`

These routes are protected **outside the application** using **Cloudflare Access**:
- Identity-based (email / domain)
- Works across changing IPs
- No login UI or auth code inside the app

The application assumes:
> If a request reaches an admin route, it is authorized.

Admin identity headers (if provided by Cloudflare) may be logged for auditing, but are **not required for authorization**.

---

## ADMIN CONSOLE (FIRST-CLASS FEATURE)

The Admin Console is the **source of truth** for:
- Manual locksmith onboarding
- Job lifecycle monitoring
- Dispatch oversight
- Issue resolution
- Refund control

This is **required** for MVP success.

---

## Admin Console — Required Pages

### 1. Locksmith Management (Manual Onboarding)

Admins must be able to:
- Manually add locksmiths
- Edit locksmith details
- Toggle:
  - `is_active`
  - `is_available`
- View:
  - Supported services
  - Internal notes
  - Job history
  - Basic acceptance/completion stats

**Add Locksmith Form**
Fields:
- Display name / business name
- Phone number (primary identifier)
- Primary city / service area
- Supported services (checkboxes)
- Typical hours (free text)
- Internal notes
- Save → locksmith is dispatchable

---

### 2. Job Dashboard (Most Important Page)

Admins see a **live list of all jobs**, sortable and filterable.

Columns:
- Job ID
- Customer phone
- Service type
- City
- Status
- Assigned locksmith
- Created time
- Deposit status

Clicking a job opens the **Job Detail View**.

---

### 3. Job Detail View (Control Panel)

Admins must be able to:
- See full job lifecycle timeline
- See deposit amount + Stripe status
- See which locksmiths were offered the job
- See all SMS messages (inbound/outbound)
- Manually:
  - Assign a locksmith
  - Cancel job
  - Restart dispatch
  - Trigger refund
  - Mark job complete

This page resolves **most operational issues**.

---

### 4. Request Sessions (Pre-Payment Funnel)

Admins can view:
- Abandoned requests
- Ineligible locations
- Drop-off between steps
- Spam / abuse attempts

Used for:
- UX improvement
- Demand analysis
- City rollout decisions

---

### 5. Messaging Audit Log

Admins can:
- View all SMS sent/received
- Filter by job or locksmith
- Inspect delivery failures

Required for:
- Disputes
- Carrier issues
- Dispatch debugging

---

## Customer Flow (No Auth)

### Step 1 — Personal Info + Location Validation
- Name, phone, address collected
- Address validated against service areas
- Request session created
- Admin sees session immediately

### Step 2 — Service Selection
- Service type + urgency collected
- Deposit amount calculated
- Admin sees service selection pre-payment

### Step 3 — Payment + Deposit
- Stripe PaymentIntent created
- Deposit captured
- Job created
- Dispatch enqueued
- Admin sees job instantly

---

## Job Lifecycle

1. CREATED (deposit captured)
2. DISPATCHING
3. OFFERED
4. ASSIGNED
5. EN_ROUTE
6. COMPLETED
7. CANCELED
8. FAILED

Admins may override **any state**.

---

## Database Schema (High-Level)

### locksmiths
- id (UUID)
- display_name
- phone (unique)
- primary_city
- supports_home_lockout
- supports_car_lockout
- supports_rekey
- supports_smart_lock
- is_active
- is_available
- notes
- onboarded_at

### jobs
- id
- customer_phone
- service_type
- address
- city
- status
- deposit_amount
- stripe_payment_intent_id
- assigned_locksmith_id
- created_at

### job_offers
- id
- job_id
- locksmith_id
- wave_number
- status
- sent_at
- responded_at

### messages
- id
- job_id
- to_phone
- from_phone
- direction
- body
- provider_message_id
- created_at

### audit_events
- id
- entity_type
- entity_id
- event_type
- payload_json
- created_at

---

## Dispatch Logic (Admin-Visible)

- Dispatch occurs in waves (e.g., 3 locksmiths per wave)
- Each wave logged
- Admin sees:
  - Who was contacted
  - Who responded
  - Why dispatch stopped

Admins can:
- Force next wave
- Manually assign
- Cancel dispatch

---

## Locksmith SMS Commands (MVP)

- `YES` → accept job
- `NO` → reject job
- `AVAILABLE` → opt in to offers
- `UNAVAILABLE` → pause offers
- `STOP` → deactivate

All commands:
- Update database
- Appear in admin audit logs

---

## Payments & Refunds

- Deposit captured before dispatch
- Stripe webhooks drive truth
- If job FAILED:
  - Admin may trigger refund
- Admin can see:
  - PaymentIntent status
  - Refund history

---

## Suggested Repository Layout (Python-First)

