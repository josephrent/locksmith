# Deployment Guide

This guide covers deploying the Locksmith application to Vercel (frontend) and Fly.io (backend).

---

## Frontend Deployment (Vercel)

### Step 1: Prepare Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

**Production:**
```
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://your-backend.fly.dev
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

**Preview/Development:**
```
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:8000
# Or use a test backend URL
# NEXT_PUBLIC_API_URL=https://your-backend-test.fly.dev
```

### Step 2: Deploy to Vercel

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Select the `apps/web` directory as the root (or configure it)

2. **Configure Build Settings:**
   - Framework Preset: **Next.js**
   - Root Directory: `apps/web` (if monorepo)
   - Build Command: `npm run build`
   - Output Directory: `.next` (default)

3. **Deploy:**
   - Vercel will automatically deploy on push to main
   - Or click "Deploy" manually

### Step 3: Update API URL

After deployment, update `NEXT_PUBLIC_API_URL` in Vercel environment variables to point to your Fly.io backend.

---

## Backend Deployment (Fly.io)

### Step 1: Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Or download from: https://fly.io/docs/hands-on/install-flyctl/
```

### Step 2: Login to Fly.io

```bash
fly auth login
```

### Step 3: Create Fly.io App

```bash
cd apps/api
fly launch
```

This will:
- Create a `fly.toml` configuration file
- Ask you to name your app
- Detect your app type (Python/FastAPI)
- Set up deployment

### Step 4: Configure Environment Variables

Set environment variables in Fly.io:

```bash
fly secrets set DATABASE_URL="postgresql+asyncpg://..."
fly secrets set TWILIO_ACCOUNT_SID="..."
fly secrets set TWILIO_AUTH_TOKEN="..."
fly secrets set TWILIO_PHONE_NUMBER="+1..."
fly secrets set STRIPE_SECRET_KEY="sk_live_..."
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
fly secrets set GOOGLE_MAPS_API_KEY="..."
fly secrets set BASE_URL="https://your-backend.fly.dev"
fly secrets set FRONTEND_URL="https://your-frontend.vercel.app"
fly secrets set APP_ENV="production"
```

Or set them in Fly.io Dashboard:
- Go to your app → Secrets
- Add each environment variable

### Step 5: Set Up Database

1. **Create PostgreSQL Database:**
   ```bash
   fly postgres create --name locksmith-db
   fly postgres attach locksmith-db --app your-backend-app
   ```

2. **Run Migrations:**
   ```bash
   fly ssh console -C "cd /app && uv run python -m alembic upgrade head"
   ```

### Step 6: Deploy

```bash
fly deploy
```

### Step 7: Get Your Backend URL

After deployment, your backend will be available at:
```
https://your-app-name.fly.dev
```

Update this in Vercel environment variables.

---

## Environment Configuration

The frontend automatically selects the API endpoint based on `NEXT_PUBLIC_ENVIRONMENT`:

### Development (Local)
- **Environment:** `development`
- **API URL:** `http://localhost:8000` (default)
- **Used when:** Running `npm run dev` locally

### Test/Staging
- **Environment:** `test`
- **API URL:** `NEXT_PUBLIC_TEST_API_URL` or `https://your-backend-test.fly.dev`
- **Used when:** Testing deployments or staging environment

### Production
- **Environment:** `production`
- **API URL:** `NEXT_PUBLIC_PROD_API_URL` or `NEXT_PUBLIC_API_URL` or `https://your-backend.fly.dev`
- **Used when:** Deployed to Vercel production

---

## Configuration Priority

The API URL is determined in this order:

1. **`NEXT_PUBLIC_API_URL`** (highest priority - overrides everything)
2. **Environment-specific URL:**
   - Production: `NEXT_PUBLIC_PROD_API_URL`
   - Test: `NEXT_PUBLIC_TEST_API_URL`
3. **Default based on environment:**
   - Production: `https://your-backend.fly.dev`
   - Test: `https://your-backend-test.fly.dev`
   - Development: `http://localhost:8000`

---

## Vercel Environment Variables Setup

### Production Environment

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `production` | Production |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.fly.dev` | Production |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `your_key` | Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | Production |

### Preview Environment (Optional)

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `test` | Preview |
| `NEXT_PUBLIC_API_URL` | `https://your-backend-test.fly.dev` | Preview |

---

## Fly.io Configuration

### Create `fly.toml` (if not auto-generated)

```toml
app = "your-backend-app"
primary_region = "iad"  # Choose your region

[build]

[env]
  APP_ENV = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 8000
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Create `Dockerfile` (if needed)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Post-Deployment Checklist

### Frontend (Vercel)
- [ ] Environment variables set in Vercel
- [ ] `NEXT_PUBLIC_API_URL` points to Fly.io backend
- [ ] Site is accessible and loads
- [ ] API calls work (check browser console)
- [ ] Admin routes protected by Cloudflare Access

### Backend (Fly.io)
- [ ] All secrets/environment variables set
- [ ] Database connected and migrations run
- [ ] Backend is accessible at `https://your-backend.fly.dev`
- [ ] Health check works: `https://your-backend.fly.dev/health`
- [ ] API docs accessible: `https://your-backend.fly.dev/docs`
- [ ] CORS allows your Vercel domain

### Database
- [ ] Migrations applied: `fly ssh console -C "cd /app && uv run python -m alembic upgrade head"`
- [ ] Database is accessible from Fly.io app

### Testing
- [ ] Public routes work (home page, request form)
- [ ] Admin routes redirect to Cloudflare Access
- [ ] API endpoints respond correctly
- [ ] SMS sending works (if configured)

---

## Troubleshooting

### Issue: Frontend can't connect to backend

**Check:**
1. `NEXT_PUBLIC_API_URL` is set correctly in Vercel
2. Backend is running and accessible
3. CORS is configured to allow your Vercel domain
4. Check browser console for CORS errors

**Fix:**
- Update CORS in `apps/api/app/main.py`:
  ```python
  allow_origins=[
    "https://your-frontend.vercel.app",
    "http://localhost:3000",
  ],
  ```

### Issue: Environment variable not working

**Check:**
1. Variable name starts with `NEXT_PUBLIC_` (required for client-side access)
2. Rebuild/redeploy after changing environment variables
3. Check `src/lib/config.ts` to see how URL is determined

### Issue: Backend not starting on Fly.io

**Check:**
1. All required environment variables are set
2. Database is accessible
3. Check logs: `fly logs`

**Fix:**
- Verify `DATABASE_URL` is correct
- Check that migrations have run
- Ensure all secrets are set

---

## Quick Reference

### Update API URL in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Edit `NEXT_PUBLIC_API_URL`
3. Redeploy (or wait for auto-deploy)

### Update Backend Secrets in Fly.io
```bash
fly secrets set KEY="value"
```

### View Backend Logs
```bash
fly logs
```

### Run Migrations on Fly.io
```bash
fly ssh console -C "cd /app && uv run python -m alembic upgrade head"
```

---

END DEPLOYMENT GUIDE
