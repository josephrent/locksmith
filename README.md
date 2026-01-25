# Locksmith Marketplace

An on-demand locksmith marketplace with **admin-first operations**. This MVP prioritizes operational control, trust, and reliability over automation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCKSMITH MARKETPLACE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Customer   │    │    Admin     │    │      Locksmith       │  │
│  │   Web Flow   │    │   Console    │    │    (SMS Interface)   │  │
│  │  (No Auth)   │    │(Network-Gated)│   │                      │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │                       │               │
│         └─────────┬─────────┴───────────────────────┘               │
│                   │                                                  │
│         ┌─────────▼─────────┐                                       │
│         │   FastAPI Backend │                                       │
│         │  (Python 3.13)    │                                       │
│         └─────────┬─────────┘                                       │
│                   │                                                  │
│    ┌──────────────┼──────────────┬──────────────┐                   │
│    │              │              │              │                    │
│ ┌──▼───┐    ┌─────▼────┐   ┌────▼────┐   ┌────▼────┐              │
│ │Postgres│   │  Redis   │   │ Twilio  │   │ Stripe  │              │
│ │   DB   │   │  Cache   │   │   SMS   │   │Payments │              │
│ └────────┘   └──────────┘   └─────────┘   └─────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Product Surfaces

1. **Customer Web Flow** - 3-step service request (no authentication)
2. **Admin Console** - Full job and locksmith management (network-gated via Cloudflare Access)
3. **SMS Interface** - Locksmith interactions via Twilio

## Tech Stack

### Backend
- **Python 3.13** + **FastAPI**
- **SQLAlchemy 2.x** (async) + **PostgreSQL**
- **Alembic** for migrations
- **Redis** for locks and caching

### Frontend
- **Next.js 14** + **React 18** + **TypeScript**
- **TailwindCSS** for styling
- **React Hook Form** + **Zod** for forms

### External Services
- **Twilio** - SMS for locksmith dispatch
- **Stripe** - Payment processing
- **Google Maps** - Address validation

## Project Structure

```
locksmith/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── admin/     # Admin endpoints (protected)
│   │   │   ├── customer.py # Customer flow
│   │   │   └── webhooks.py # Twilio/Stripe webhooks
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── config.py      # Settings
│   │   ├── database.py    # DB connection
│   │   └── main.py        # FastAPI app
│   ├── alembic/           # Migrations
│   ├── pyproject.toml     # Dependencies (uv)
│   └── uv.lock            # Lock file
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── request/           # Customer flow
│   │   │   └── admin/             # Admin console
│   │   │       ├── page.tsx       # Dashboard
│   │   │       ├── jobs/          # Job management
│   │   │       ├── locksmiths/    # Locksmith management
│   │   │       ├── messages/      # SMS audit log
│   │   │       └── analytics/     # Funnel analytics
│   │   └── lib/
│   │       └── api.ts             # API client
│   ├── package.json
│   └── tailwind.config.ts
│
└── README.md
```

## Quick Start

### Prerequisites
- **uv** (Python package manager) - [Install uv](https://github.com/astral-sh/uv)
- Python 3.12+ (uv will automatically install the correct version)
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Backend Setup

```bash
cd backend

# Install dependencies (uv will create venv automatically)
uv sync

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run migrations
uv run python -m alembic upgrade head

# Start server
uv run python -m uvicorn app.main:app --reload --port 8000

```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx" >> .env.local

# Start development server
npm run dev
```

### Access the Application

- **Customer Site**: http://localhost:3000
- **Admin Console**: http://localhost:3000/admin
- **API Docs**: http://localhost:8000/docs

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/locksmith

# Redis
REDIS_URL=redis://localhost:6379/0

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Google Maps
GOOGLE_MAPS_API_KEY=your_api_key

# App Settings
APP_ENV=development
BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## Admin Access Control

Admin routes (`/admin/*`, `/api/admin/*`) are protected via **Cloudflare Access** at the network edge:

1. No in-app authentication
2. If a request reaches admin routes, it's trusted
3. Optional: Log `Cf-Access-Authenticated-User-Email` header for auditing

See `md_documents/admin_control.md` for full Cloudflare configuration.

## Job Lifecycle

```
CREATED → DISPATCHING → OFFERED → ASSIGNED → EN_ROUTE → COMPLETED
                                      ↓
                                  CANCELED / FAILED
```

1. **CREATED**: Deposit captured, job ready for dispatch
2. **DISPATCHING**: Sending offers to locksmiths in waves
3. **OFFERED**: Awaiting locksmith responses
4. **ASSIGNED**: Locksmith accepted
5. **EN_ROUTE**: Locksmith on the way
6. **COMPLETED**: Job finished
7. **CANCELED/FAILED**: Job terminated

## SMS Commands (Locksmith)

| Command     | Action                    |
|-------------|---------------------------|
| `YES`       | Accept current job offer  |
| `NO`        | Decline current job offer |
| `AVAILABLE` | Opt in to receive offers  |
| `UNAVAILABLE` | Pause offers            |
| `STOP`      | Deactivate account        |

## API Endpoints

### Customer (Public)
- `POST /api/request/start` - Start session
- `POST /api/request/{id}/location` - Validate address
- `POST /api/request/{id}/service` - Select service
- `POST /api/request/{id}/payment-intent` - Get Stripe intent
- `POST /api/request/{id}/complete` - Complete booking

### Admin (Protected)
- `GET/POST /api/admin/locksmiths` - List/create locksmiths
- `PATCH /api/admin/locksmiths/{id}` - Update locksmith
- `GET /api/admin/jobs` - List jobs
- `GET /api/admin/jobs/{id}` - Job details
- `POST /api/admin/jobs/{id}/assign` - Manual assignment
- `POST /api/admin/jobs/{id}/dispatch` - Control dispatch
- `POST /api/admin/jobs/{id}/refund` - Process refund
- `GET /api/admin/messages` - SMS audit log
- `GET /api/admin/sessions` - Request sessions

### Webhooks
- `POST /api/webhooks/twilio/sms` - Inbound SMS
- `POST /api/webhooks/stripe` - Payment events

## Production Deployment

### Backend (Railway/Render/Fly.io)
```bash
# Dockerfile or Procfile
# Using uv (recommended)
web: uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT

# Or traditional pip (if uv not available)
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel)
```bash
# Auto-detects Next.js
vercel deploy
```

### Required Services
1. Managed PostgreSQL (Neon, Supabase, RDS)
2. Managed Redis (Upstash, Redis Cloud)
3. Cloudflare DNS + Access (for admin protection)
4. Twilio account with phone number
5. Stripe account with webhook

## License

Proprietary - All rights reserved
 