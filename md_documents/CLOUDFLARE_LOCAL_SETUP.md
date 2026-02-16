# Cloudflare Tunnel Setup for Local Development

This guide shows you how to use Cloudflare Tunnel (formerly Argo Tunnel) to connect your locally running application to Cloudflare, enabling you to test Cloudflare Access and proxy features locally.

## Why Cloudflare Tunnel?

- ✅ No need for public IP or port forwarding
- ✅ Secure connection (encrypted tunnel)
- ✅ Works with Cloudflare Access
- ✅ Free tier available
- ✅ Works behind firewalls/NAT

---

## Step 1: Install Cloudflared

Cloudflared is the CLI tool for Cloudflare Tunnel.

### Windows (PowerShell):
```powershell
# Download using winget
winget install --id Cloudflare.cloudflared

# Or download manually from:
# https://github.com/cloudflare/cloudflared/releases
# Extract and add to PATH
```

### Verify Installation:
```bash
cloudflared --version
```

---

## Step 2: Authenticate with Cloudflare

1. **Login to Cloudflare:**
   ```bash
   cloudflared tunnel login
   ```
   
   This will:
   - Open your browser
   - Ask you to select your domain
   - Authorize the tunnel
   - Save credentials to `C:\Users\<your-username>\.cloudflared\cert.pem`

---

## Step 3: Create a Tunnel

1. **Create a named tunnel:**
   ```bash
   cloudflared tunnel create locksmith-dev
   ```
   
   This creates a tunnel and gives you a Tunnel ID (save this).

2. **Create configuration file:**
   
   Create `C:\Users\<your-username>\.cloudflared\config.yml`:
   
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: C:\Users\<your-username>\.cloudflared\<tunnel-id>.json
   
   ingress:
     # Frontend (Next.js)
     - hostname: yourdomain.com
       service: http://localhost:3000
     
     # Backend API (FastAPI)
     - hostname: api.yourdomain.com
       service: http://localhost:8000
     
     # Catch-all (optional)
     - service: http_status:404
   ```

   **Note:** Replace:
   - `<your-tunnel-id>` with the ID from step 1
   - `yourdomain.com` with your actual domain
   - Adjust ports if your apps run on different ports

---

## Step 4: Configure DNS

1. **Route traffic to your tunnel:**
   ```bash
   cloudflared tunnel route dns locksmith-dev yourdomain.com
   cloudflared tunnel route dns locksmith-dev api.yourdomain.com
   ```

   Or manually in Cloudflare Dashboard:
   - Go to DNS → Records
   - Add CNAME record:
     - Name: `@` (or `www`)
     - Target: `<tunnel-id>.cfargotunnel.com`
     - Proxy: Enabled (orange cloud) ✅
   - Add another for API:
     - Name: `api`
     - Target: `<tunnel-id>.cfargotunnel.com`
     - Proxy: Enabled ✅

---

## Step 5: Start Your Local Apps

1. **Start your backend:**
   ```bash
   cd apps/api
   uv run uvicorn app.main:app --reload --port 8000
   ```

2. **Start your frontend:**
   ```bash
   cd apps/web
   npm run dev
   # Runs on port 3000
   ```

---

## Step 6: Start the Tunnel

```bash
cloudflared tunnel run locksmith-dev
```

You should see:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://yourdomain.com                                                                    |
+--------------------------------------------------------------------------------------------+
```

---

## Step 7: Test Cloudflare Access

Now you can test Cloudflare Access on your local app:

1. **Visit your domain:**
   - `https://yourdomain.com` - Should load your frontend
   - `https://yourdomain.com/admin` - Should redirect to Cloudflare Access login
   - `https://api.yourdomain.com/api/admin/jobs` - Should require authentication

2. **Test public routes:**
   - `https://yourdomain.com/request` - Should work without auth
   - `https://api.yourdomain.com/api/request/start` - Should work without auth

---

## Step 8: Set Up Cloudflare Access (If Not Done)

Follow the main setup guide (`CLOUDFLARE_SETUP.md`) Step 3 to configure Access:

1. Enable Zero Trust
2. Set up authentication provider (Google OAuth)
3. Create Access Application:
   - Application domain: `yourdomain.com`
   - Path rules:
     - `/admin*`
     - `/api/admin*`
4. Create Access Policy with your email

---

## Running Tunnel in Background (Optional)

### Windows (PowerShell):
```powershell
# Run as background job
Start-Process cloudflared -ArgumentList "tunnel run locksmith-dev" -WindowStyle Hidden

# Or create a scheduled task
```

### Or use a process manager:
- PM2 (if using Node.js)
- Supervisor
- Windows Task Scheduler

---

## Troubleshooting

### Issue: "Tunnel not found"
- Make sure you created the tunnel: `cloudflared tunnel list`
- Verify the tunnel ID in `config.yml` matches

### Issue: "Connection refused"
- Make sure your local apps are running
- Check the ports in `config.yml` match your app ports
- Verify firewall isn't blocking localhost connections

### Issue: "DNS not resolving"
- Wait a few minutes for DNS propagation
- Verify DNS records point to `<tunnel-id>.cfargotunnel.com`
- Check that proxy is enabled (orange cloud)

### Issue: "Access not working"
- Verify Access Application is configured
- Check path rules match (`/admin*`, `/api/admin*`)
- Ensure your email is in the Access Policy
- Try clearing browser cache/cookies

---

## Quick Start Script

Create `start-tunnel.ps1`:

```powershell
# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps/api; uv run uvicorn app.main:app --reload --port 8000"

# Start frontend  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps/web; npm run dev"

# Wait a moment for apps to start
Start-Sleep -Seconds 3

# Start tunnel
cloudflared tunnel run locksmith-dev
```

Run with:
```powershell
.\start-tunnel.ps1
```

---

## Alternative: Quick Tunnel (Temporary)

For quick testing without permanent setup:

```bash
# Creates a temporary tunnel (expires after use)
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary URL like `https://random-name.trycloudflare.com` that you can use for testing, but it won't work with your custom domain or Access policies.

---

## Next Steps

Once your tunnel is running and Access is configured:

1. ✅ Test admin routes require authentication
2. ✅ Test public routes work without auth
3. ✅ Verify SSL/TLS is working
4. ✅ Test from different networks/IPs
5. ✅ Set up identity headers for audit logging (optional)

---

END CLOUDFLARE LOCAL SETUP
