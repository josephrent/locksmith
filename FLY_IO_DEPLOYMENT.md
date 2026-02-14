# Fly.io Backend Deployment Guide

Step-by-step instructions for deploying the Locksmith API to Fly.io.

---

## Prerequisites

1. **Fly.io Account**: Sign up at [fly.io](https://fly.io)
2. **Fly CLI Installed**: See Step 1 below
3. **Database Ready**: You'll need a PostgreSQL database (Fly.io Postgres or external like Neon)

---

## Step 1: Install Fly CLI

### Windows (PowerShell)
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### macOS/Linux
```bash
curl -L https://fly.io/install.sh | sh
```

### Verify Installation
```bash
fly version
```

---

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open your browser to authenticate.

---

## Step 3: Navigate to API Directory

```bash
cd apps/api
```

---

## Step 4: Initialize Fly.io App

```bash
fly launch
```

**When prompted:**
- **App name**: Choose a name (e.g., `locksmith-api` or `yourname-locksmith-api`)
  - Must be globally unique
  - Use lowercase, hyphens only
- **Region**: Choose closest to you (e.g., `iad` for Washington D.C., `sjc` for San Jose)
- **PostgreSQL**: Choose **No** (we'll set this up separately)
- **Redis**: Choose **No** (you're using Upstash)
- **Deploy now**: Choose **No** (we need to set secrets first)

This creates `fly.toml` in `apps/api/`.

---

## Step 5: Set Environment Variables (Secrets)

Set all your environment variables as Fly.io secrets:

```bash
# Database (use your Neon or other PostgreSQL URL)
fly secrets set DATABASE_URL="postgresql+asyncpg://user:pass@host:port/dbname?ssl=require"

# Redis (use your Upstash URL)
fly secrets set REDIS_URL="rediss://default:token@host:port"

# Twilio
fly secrets set TWILIO_ACCOUNT_SID="AC..."
fly secrets set TWILIO_AUTH_TOKEN="your_token"
fly secrets set TWILIO_PHONE_NUMBER="+1..."

# Stripe (if using)
fly secrets set STRIPE_SECRET_KEY="sk_live_..."
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."

# Google Maps
fly secrets set GOOGLE_MAPS_API_KEY="your_key"

# AWS S3 (for photo storage)
fly secrets set AWS_ACCESS_KEY_ID="AKIA..."
fly secrets set AWS_SECRET_ACCESS_KEY="your_secret"
fly secrets set AWS_REGION="us-east-2"
fly secrets set S3_BUCKET_NAME="locksmith-photos"

# App Settings
fly secrets set BASE_URL="https://your-app-name.fly.dev"
fly secrets set FRONTEND_URL="https://your-frontend.vercel.app"
fly secrets set APP_ENV="production"
```

**Critical:** `FRONTEND_URL` must be the **customer-facing web app** URL (e.g. your Next.js app on Vercel), **not** the API URL. The SMS "View all quotes" link is built as `{FRONTEND_URL}/request/offers?session=...`. If you set `FRONTEND_URL` to the API (e.g. `https://locksmith.fly.dev`), customers will get a broken link that hits the API and shows JSON or an error instead of the offers page.

**Or set them in Fly.io Dashboard:**
1. Go to [fly.io dashboard](https://fly.io/dashboard)
2. Select your app
3. Go to **Secrets** tab
4. Add each variable

**Important**: Replace `your-app-name` with your actual Fly.io app name from Step 4.

---

## Step 6: Set Up Database

### Option A: Use Fly.io Postgres (Recommended for simplicity)

```bash
# Create a Postgres database
fly postgres create --name locksmith-db --region iad

# Attach it to your app (this sets DATABASE_URL automatically)
fly postgres attach locksmith-db
```

### Option B: Use External Database (Neon, etc.)

If using Neon or another external database:
1. Get your connection string
2. Set it as `DATABASE_URL` secret (already done in Step 5)

---

## Step 7: Run Database Migrations

After database is set up, run migrations:

```bash
fly ssh console -C "cd /app && uv run python -m alembic upgrade head"
```

Or if you want to run migrations before first deploy:

```bash
# SSH into the app
fly ssh console

# Inside the console:
cd /app
uv run python -m alembic upgrade head
exit
```

---

## Step 8: Deploy

```bash
fly deploy
```

This will:
1. Build your Docker image
2. Push it to Fly.io
3. Deploy and start your app

**First deploy may take 5-10 minutes.**

### Deploy on push to main (optional)

To have Fly deploy automatically when you push to the `main` branch:

1. **Create a Fly deploy token** (one-time, from your machine):
   ```bash
   cd apps/api
   fly tokens create deploy -x 999999h
   ```
   Copy the token (it starts with `FlyV1...`).

2. **Add the token as a GitHub secret:**
   - Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `FLY_API_TOKEN`
   - Value: paste the token from step 1

3. **Workflow:** The repo includes `.github/workflows/fly-deploy.yml`, which runs `fly deploy` from `apps/api` on every push to `main`.

4. **Push to main** — the **Actions** tab will show the run; when it succeeds, the app is deployed.

---

## Step 9: Verify Deployment

### Check App Status
```bash
fly status
```

### Check Logs
```bash
fly logs
```

### Test Health Endpoint
```bash
fly curl /health
```

Or visit in browser:
```
https://your-app-name.fly.dev/health
```

Should return:
```json
{"status": "healthy", "service": "locksmith-api"}
```

### Test API Docs
Visit:
```
https://your-app-name.fly.dev/docs
```

---

## Step 10: Update Vercel Frontend

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_API_URL` to:
   ```
   https://your-app-name.fly.dev
   ```
3. Redeploy frontend (or wait for auto-deploy)

---

## Troubleshooting

### Issue: Build fails with "Module not found"

**Solution**: Make sure all dependencies are in `pyproject.toml` and `uv.lock` is committed.

### Issue: Database connection errors

**Solution**: 
- Verify `DATABASE_URL` is set correctly
- Check database allows connections from Fly.io IPs
- For Neon: Make sure connection string uses `-pooler` endpoint for production

### Issue: App crashes on startup

**Solution**:
```bash
# Check logs
fly logs

# SSH into app to debug
fly ssh console
```

### Issue: Can't connect to Redis

**Solution**:
- Verify `REDIS_URL` is set correctly
- Check Upstash allows connections from Fly.io
- Ensure Redis URL uses `rediss://` (with SSL) for Upstash

### Issue: Port binding errors

**Solution**: Make sure `fly.toml` has `internal_port = 8000` and your app listens on `0.0.0.0:8000`

---

## Useful Fly.io Commands

```bash
# View app status
fly status

# View logs (live)
fly logs

# SSH into running app
fly ssh console

# Scale app (if needed)
fly scale count 1

# View app info
fly info

# Open app in browser
fly open

# Restart app
fly apps restart your-app-name

# View secrets (names only, not values)
fly secrets list
```

---

## Post-Deployment Checklist

- [ ] App is running: `fly status`
- [ ] Health check works: `https://your-app.fly.dev/health`
- [ ] API docs accessible: `https://your-app.fly.dev/docs`
- [ ] Database migrations applied
- [ ] Frontend can connect: Check Vercel logs
- [ ] SMS sending works: Test with a request
- [ ] Webhooks work: Test Twilio webhook endpoint

---

## Updating Your App

After making code changes:

```bash
cd apps/api
fly deploy
```

Fly.io will:
1. Build new Docker image
2. Deploy with zero downtime
3. Switch traffic to new version

---

## Monitoring

- **Logs**: `fly logs` or in Fly.io Dashboard
- **Metrics**: Available in Fly.io Dashboard → Metrics
- **Alerts**: Set up in Fly.io Dashboard → Alerts

---

## Cost Estimation

Fly.io pricing:
- **Free tier**: 3 shared-cpu-1x VMs with 256MB RAM
- **Paid**: ~$1.94/month per VM (1GB RAM, 1 shared CPU)

For this app, you'll likely need:
- 1 VM for API: ~$2/month
- Postgres (if using Fly.io): ~$15/month for smallest instance

**Total**: ~$17-20/month for API + Database on Fly.io

---

## Next Steps

1. Set up monitoring/alerting
2. Configure custom domain (optional)
3. Set up CI/CD for auto-deployment
4. Configure backups for database

---

END DEPLOYMENT GUIDE
