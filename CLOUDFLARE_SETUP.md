# Cloudflare Proxy & Access Setup Guide

This guide walks you through setting up Cloudflare DNS proxying and Cloudflare Access to protect your admin routes.

## Prerequisites

- A domain name (e.g., `yourdomain.com`)
- Cloudflare account (free tier works)
- Your application deployed and accessible via IP/URL

---

## Step 1: Add Domain to Cloudflare

1. **Log in to Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Click "Add a Site"

2. **Enter Your Domain**
   - Enter your domain (e.g., `yourdomain.com`)
   - Click "Add site"

3. **Select Plan**
   - Free plan is sufficient for basic proxying and Access
   - Click "Continue"

4. **Review DNS Records**
   - Cloudflare will scan your existing DNS records
   - Review and confirm they look correct
   - Click "Continue"

5. **Update Nameservers**
   - Cloudflare will provide you with 2 nameservers (e.g., `alice.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
   - Go to your domain registrar (where you bought the domain)
   - Replace your current nameservers with Cloudflare's nameservers
   - **Important**: This can take 24-48 hours to propagate, but usually happens within a few hours

---

## Step 2: Configure DNS Records with Proxy

Once your domain is active on Cloudflare:

1. **Go to DNS Settings**
   - In Cloudflare dashboard, click on your domain
   - Go to "DNS" → "Records"

2. **Add/Update Records**

   **For Frontend (Next.js on Vercel or similar):**
   ```
   Type: CNAME
   Name: @ (or www)
   Target: cname.vercel-dns.com (or your hosting provider's CNAME)
   Proxy status: Proxied (orange cloud) ✅
   ```

   **For Backend API (if using subdomain):**
   ```
   Type: A (or CNAME)
   Name: api
   Target: your-backend-ip-or-hostname
   Proxy status: Proxied (orange cloud) ✅
   ```

   **Important**: The **orange cloud** (Proxied) must be enabled for Access to work.

3. **SSL/TLS Settings**
   - Go to "SSL/TLS" → "Overview"
   - Set encryption mode to **"Full"** or **"Full (strict)"**
   - This ensures encrypted connection between Cloudflare and your origin

---

## Step 3: Set Up Cloudflare Access

### 3.1 Enable Zero Trust (Free)

1. **Access Zero Trust Dashboard**
   - In Cloudflare dashboard, click "Zero Trust" in the sidebar
   - If you don't see it, go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
   - You may need to sign up for Zero Trust (free tier available)

2. **Set Up Authentication Provider (One-Time)**

   - Go to "Access" → "Authentication" → "Login methods"
   - Click "Add new"
   - Select **"Google"** (recommended) or another provider
   - Follow the OAuth setup instructions:
     - Create OAuth credentials in Google Cloud Console
     - Add authorized redirect URI: `https://<your-team-name>.cloudflareaccess.com`
     - Enter Client ID and Client Secret
   - Save the configuration

### 3.2 Create Access Application

1. **Create Application**
   - Go to "Access" → "Applications"
   - Click "Add an application"
   - Select **"Self-hosted"**

2. **Configure Application**

   **Application Name:**
   ```
   Locksmith Admin Console
   ```

   **Application Domain:**
   ```
   yourdomain.com
   ```

   **Session Duration:**
   ```
   24 hours (or your preference)
   ```

3. **Add Path Rules**

   Click "Add a rule" and add these paths:

   **Rule 1: Admin UI**
   ```
   Path: /admin*
   ```

   **Rule 2: Admin API**
   ```
   Path: /api/admin*
   ```

   **Note**: These rules protect both the frontend admin pages and backend admin API endpoints.

4. **Configure Policy**

   Click "Add a policy" to define who can access:

   **Policy Name:**
   ```
   Admin Access
   ```

   **Action:**
   ```
   Allow
   ```

   **Include Rules:**
   - **Emails**: Add specific admin email addresses
     ```
     user@example.com
     admin@example.com
     ```
   - **OR Email Domains**: Allow entire domain
     ```
     @yourcompany.com
     ```

   **Require:**
   - ✅ **MFA** (recommended)
   - ✅ **Email** (if using email-based access)

   **Save Policy**

5. **Save Application**

   - Review your configuration
   - Click "Add application"
   - Cloudflare will generate a unique application ID

---

## Step 4: Configure Application Settings

### 4.1 Update Environment Variables

**Backend (.env):**
```env
# Update these to use your Cloudflare-proxied domain
BASE_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

**Frontend (.env.local or Vercel environment variables):**
```env
NEXT_PUBLIC_API_URL=https://yourdomain.com
# Or if using subdomain:
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 4.2 CORS Configuration (Backend)

Ensure your backend allows requests from your Cloudflare domain:

```python
# In app/main.py or similar
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",
        "http://localhost:3000",  # Keep for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Step 5: Optional - Identity Headers for Auditing

Cloudflare Access can inject identity information into requests. This is useful for audit logging.

### 5.1 Enable Identity Headers

1. **In Access Application Settings**
   - Go to your application → "Policies"
   - Edit your policy
   - Scroll to "Advanced" → "Headers"
   - Enable "Add user identity headers"

2. **Available Headers**

   Cloudflare will inject these headers into requests:
   - `Cf-Access-Authenticated-User-Email` - User's email
   - `Cf-Access-Authenticated-User-Id` - User's ID
   - `Cf-Access-Jwt-Assertion` - JWT token

### 5.2 Log Identity in Backend (Optional)

You can log admin actions using these headers:

```python
from fastapi import Header, Request

@app.post("/api/admin/jobs/{job_id}/assign")
async def assign_job(
    job_id: UUID,
    request: Request,
    # ... other params
):
    # Get admin email from Cloudflare Access header
    admin_email = request.headers.get("Cf-Access-Authenticated-User-Email", "unknown")
    
    # Log to audit_events table
    await audit_service.log_action(
        actor_email=admin_email,
        action_type="job_assigned",
        entity_id=job_id,
    )
    
    # ... rest of function
```

---

## Step 6: Testing

### 6.1 Test Public Routes (Should Work Without Auth)

- ✅ `https://yourdomain.com` - Home page (public)
- ✅ `https://yourdomain.com/request` - Customer form (public)
- ✅ `https://yourdomain.com/api/request/start` - Public API

### 6.2 Test Protected Routes (Should Require Auth)

- 🔒 `https://yourdomain.com/admin` - Should redirect to Cloudflare login
- 🔒 `https://yourdomain.com/api/admin/jobs` - Should return 403 without auth

### 6.3 Test After Login

1. Visit `https://yourdomain.com/admin`
2. You should be redirected to Cloudflare Access login
3. Sign in with your allowed email/Google account
4. After authentication, you should access the admin console
5. Admin API calls should also work (they'll include the auth cookie)

---

## Troubleshooting

### Issue: "Access Denied" Even After Login

**Solution:**
- Check that your email is in the Access policy
- Verify the policy "Include" rules match your email/domain
- Check that MFA is completed if required

### Issue: Public Routes Are Blocked

**Solution:**
- Verify your path rules only include `/admin*` and `/api/admin*`
- Check that other routes are not accidentally included in the policy

### Issue: API Calls Fail with CORS Errors

**Solution:**
- Ensure `FRONTEND_URL` in backend matches your Cloudflare domain
- Update CORS `allow_origins` to include your Cloudflare domain
- Check that credentials are allowed if using cookies

### Issue: SSL/TLS Errors

**Solution:**
- Go to "SSL/TLS" → "Overview"
- Set encryption mode to "Full" or "Full (strict)"
- Ensure your origin server has valid SSL certificate (or use Cloudflare Origin Certificate)

### Issue: Changes Not Taking Effect

**Solution:**
- DNS changes can take up to 48 hours (usually much faster)
- Clear browser cache and cookies
- Try incognito/private browsing mode
- Check Cloudflare cache: "Caching" → "Configuration" → "Purge Everything"

---

## Security Checklist

- [ ] Domain is proxied through Cloudflare (orange cloud enabled)
- [ ] SSL/TLS mode set to "Full" or "Full (strict)"
- [ ] Access application created with correct path rules
- [ ] Access policy includes only authorized emails/domains
- [ ] MFA enabled (recommended)
- [ ] Public routes remain accessible
- [ ] Admin routes require authentication
- [ ] Environment variables updated to use Cloudflare domain
- [ ] CORS configured correctly
- [ ] Identity headers enabled (optional, for auditing)

---

## Additional Resources

- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Cloudflare DNS Setup](https://developers.cloudflare.com/dns/)
- [Cloudflare Zero Trust Pricing](https://developers.cloudflare.com/cloudflare-one/pricing/)

---

## Quick Reference: Path Rules

Your Access application should protect:
- `/admin*` - All admin UI pages
- `/api/admin*` - All admin API endpoints

Everything else remains public:
- `/` - Home page
- `/request*` - Customer request flow
- `/api/request*` - Customer API endpoints
- `/api/webhooks*` - Webhook endpoints (public, but secured by webhook secrets)

---

END CLOUDFLARE SETUP GUIDE
