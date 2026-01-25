# Cloudflare Access Quick Start Guide

Step-by-step instructions to set up Cloudflare Access for your Locksmith admin console.

---

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] A domain name (e.g., `yourdomain.com`)
- [ ] Cloudflare account (free tier works)
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at your registrar
- [ ] Google account (for OAuth, or choose another provider)

---

## Part 1: Set Up Cloudflare Tunnel (For Local Development)

### Step 1.1: Install Cloudflared

**Windows (PowerShell):**
```powershell
winget install --id Cloudflare.cloudflared
```

**Verify installation:**
```bash
cloudflared --version
```

### Step 1.2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will:
1. Open your browser
2. Ask you to select your domain
3. Authorize the tunnel
4. Save credentials automatically

### Step 1.3: Create a Named Tunnel

```bash
cloudflared tunnel create locksmith-dev
```

**Save the Tunnel ID** that's displayed (you'll need it).

### Step 1.4: Create Configuration File

Create: `C:\Users\<your-username>\.cloudflared\config.yml`

Replace `<your-username>` with your Windows username, and `<tunnel-id>` with the ID from Step 1.3:

```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\<your-username>\.cloudflared\<tunnel-id>.json

ingress:
  # Frontend (Next.js on port 3000)
  - hostname: yourdomain.com
    service: http://localhost:3000
  
  # Backend API (FastAPI on port 8000)
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  
  # Catch-all (must be last)
  - service: http_status:404
```

**Important:** Replace `yourdomain.com` with your actual domain.

### Step 1.5: Route DNS to Tunnel

```bash
cloudflared tunnel route dns locksmith-dev yourdomain.com
cloudflared tunnel route dns locksmith-dev api.yourdomain.com
```

Or manually in Cloudflare Dashboard:
- Go to **DNS** → **Records**
- Add CNAME:
  - Name: `@`
  - Target: `<tunnel-id>.cfargotunnel.com`
  - Proxy: **Enabled** (orange cloud) ✅
- Add another CNAME:
  - Name: `api`
  - Target: `<tunnel-id>.cfargotunnel.com`
  - Proxy: **Enabled** ✅

### Step 1.6: Start Your Local Apps

**Terminal 1 - Backend:**
```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```

### Step 1.7: Start the Tunnel

**Terminal 3:**
```bash
cloudflared tunnel run locksmith-dev
```

You should see:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                                         |
|  https://yourdomain.com                                                                    |
+--------------------------------------------------------------------------------------------+
```

**Test it:** Visit `https://yourdomain.com` - should show your app!

---

## Part 2: Set Up Cloudflare Access

### Step 2.1: Enable Zero Trust

1. Go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. If prompted, sign up for Zero Trust (free tier available)
3. Select your team name

### Step 2.2: Set Up Google OAuth (Authentication Provider)

1. In Zero Trust dashboard, go to **Access** → **Authentication** → **Login methods**
2. Click **"Add new"**
3. Select **"Google"**
4. You'll need to create OAuth credentials:

   **In Google Cloud Console:**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project (or use existing)
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: 
     ```
     https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback
     ```
     (Replace `<your-team-name>` with your Cloudflare team name)
   - Copy the **Client ID** and **Client Secret**

5. **Back in Cloudflare:**
   - Paste Client ID and Client Secret
   - Click **Save**

### Step 2.3: Create Access Application

1. In Zero Trust dashboard, go to **Access** → **Applications**
2. Click **"Add an application"**
3. Select **"Self-hosted"**

4. **Configure Application:**
   - **Application name:** `Locksmith Admin Console`
   - **Application domain:** `yourdomain.com` (your actual domain)
   - **Session duration:** `24 hours` (or your preference)

5. **Add Path Rules:**
   Click **"Add a rule"** and add:
   
   **Rule 1:**
   - **Path:** `/admin*`
   - **Policy:** (we'll create this next)
   
   **Rule 2:**
   - **Path:** `/api/admin*`
   - **Policy:** (same policy)

6. **Create Access Policy:**
   Click **"Add a policy"**:
   
   - **Policy name:** `Admin Access`
   - **Action:** `Allow`
   - **Include:**
     - Select **"Emails"**
     - Add your admin email(s):
       ```
       your-email@example.com
       admin@yourcompany.com
       ```
     - OR select **"Email domains"** and add:
       ```
       @yourcompany.com
       ```
   - **Require:**
     - ✅ **Email** (checked by default)
     - ✅ **MFA** (recommended, but optional)
   
   Click **"Save policy"**

7. **Assign Policy to Rules:**
   - Select the policy you just created for both `/admin*` and `/api/admin*` rules

8. **Save Application:**
   - Review your settings
   - Click **"Add application"**

---

## Part 3: Update Your App Configuration

### Step 3.1: Update Backend Environment Variables

Edit `apps/api/.env`:

```env
# Update these to use your Cloudflare domain
BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Step 3.2: Update Frontend Environment Variables

Edit `apps/web/.env.local` (or create it):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Step 3.3: Update CORS in Backend

Check `apps/api/app/main.py` and ensure CORS allows your domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",  # Add your Cloudflare domain
        "http://localhost:3000",   # Keep for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Part 4: Test Everything

### Test 1: Public Routes (Should Work Without Auth)

1. Visit `https://yourdomain.com`
   - ✅ Should load your home page

2. Visit `https://yourdomain.com/request`
   - ✅ Should load the request form

3. Visit `https://api.yourdomain.com/api/request/start` (via API client)
   - ✅ Should work without authentication

### Test 2: Admin Routes (Should Require Auth)

1. **Unauthorized Access:**
   - Open an incognito/private browser window
   - Visit `https://yourdomain.com/admin`
   - ✅ Should redirect to Cloudflare login page
   - Try logging in with an email NOT in your Access Policy
   - ✅ Should show "Access Denied" page

2. **Authorized Access:**
   - Visit `https://yourdomain.com/admin`
   - ✅ Should redirect to Cloudflare login
   - Log in with an email IN your Access Policy
   - ✅ Should redirect back to `/admin` and show your admin dashboard
   - ✅ Should be able to navigate admin pages

3. **API Protection:**
   - Try accessing `https://api.yourdomain.com/api/admin/jobs` without auth
   - ✅ Should return 403 or redirect to login

---

## Part 5: SSL/TLS Configuration

1. Go to Cloudflare Dashboard → Your Domain → **SSL/TLS** → **Overview**
2. Set encryption mode to **"Full"** or **"Full (strict)"**
3. This ensures encrypted connection between Cloudflare and your origin

---

## Troubleshooting

### Issue: "Tunnel not found"
- Verify tunnel exists: `cloudflared tunnel list`
- Check tunnel ID in `config.yml` matches

### Issue: "Can't access admin - no redirect"
- Verify Access Application is saved
- Check path rules are `/admin*` and `/api/admin*`
- Ensure your email is in the Access Policy
- Clear browser cache/cookies

### Issue: "Access Denied even with correct email"
- Check email spelling in Access Policy
- Verify you're using the email that matches the policy
- Try logging out and back in

### Issue: "DNS not resolving"
- Wait a few minutes for DNS propagation
- Verify DNS records point to `<tunnel-id>.cfargotunnel.com`
- Check proxy is enabled (orange cloud)

### Issue: "Apps not connecting through tunnel"
- Verify local apps are running on correct ports (3000, 8000)
- Check `config.yml` has correct ports
- Ensure tunnel is running: `cloudflared tunnel run locksmith-dev`

---

## Quick Reference Commands

```bash
# List tunnels
cloudflared tunnel list

# Run tunnel
cloudflared tunnel run locksmith-dev

# Delete tunnel (if needed)
cloudflared tunnel delete locksmith-dev

# Check tunnel status
cloudflared tunnel info locksmith-dev
```

---

## Next Steps

Once everything is working:

1. ✅ Test from different networks/IPs
2. ✅ Add more admin emails to Access Policy
3. ✅ Set up MFA (recommended)
4. ✅ Configure identity headers for audit logging (optional)
5. ✅ Set up production deployment with same Access rules

---

## Summary

**What you've set up:**
- ✅ Cloudflare Tunnel connecting local app to Cloudflare
- ✅ Cloudflare Access protecting `/admin*` and `/api/admin*`
- ✅ Google OAuth authentication
- ✅ Access Policy with your admin emails

**User Experience:**
- Public routes (`/`, `/request`) → Work without auth
- Admin routes (`/admin`, `/api/admin/*`) → Require Cloudflare login
- Unauthorized users → See "Access Denied"
- Authorized users → Access admin console

**No code changes needed** - Cloudflare handles all authentication!

---

END QUICK START GUIDE
