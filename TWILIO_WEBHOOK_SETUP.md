# Twilio Webhook Setup

When someone texts your Twilio phone number, Twilio needs to **POST** that message to your API. This guide walks you through exposing your local API and configuring Twilio to use it.

**Your webhook path (already in the app):** `POST /api/webhooks/twilio/sms`

---

## Option A: ngrok (fastest for testing)

Use this if you just want to test inbound SMS quickly without a domain.

### 1. Install ngrok

- Download: [https://ngrok.com/download](https://ngrok.com/download) (or `winget install Ngrok.Ngrok` on Windows)
- **Sign up (required):** [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup) — ngrok needs a free account to run tunnels.
- **Get your authtoken:** After signing in, go to [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) and copy the token.
- **Configure ngrok (one time):** In a terminal run:
  ```bash
  ngrok config add-authtoken YOUR_TOKEN_HERE
  ```
  Replace `YOUR_TOKEN_HERE` with the token from the dashboard. Then you can use `ngrok http 8000` without signing in again.

### 2. Start your API

In a terminal:

```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

Leave it running.

### 3. Start ngrok

In a **second** terminal:

```bash
ngrok http 8000
```

You’ll see something like:

```
Forwarding   https://abc123def456.ngrok-free.app -> http://localhost:8000
```

Copy the **https** URL (e.g. `https://abc123def456.ngrok-free.app`). That’s your **public base URL** for the API.

### 4. Your webhook URL

Your Twilio webhook URL is:

```
https://<your-ngrok-host>/api/webhooks/twilio/sms
```

Example: `https://abc123def456.ngrok-free.app/api/webhooks/twilio/sms`

**Important:** Use **https** and the path **exactly** as above. Method must be **POST**.

---

## Option B: Cloudflare Tunnel (if you have a domain)

If you already use Cloudflare and have a tunnel that forwards to your API (e.g. `api.yourdomain.com` → `http://localhost:8000`), use that base URL instead of ngrok.

Your webhook URL would be:

```
https://api.yourdomain.com/api/webhooks/twilio/sms
```

See `CLOUDFLARE_QUICK_START.md` for tunnel setup. Make sure the tunnel is running and `api.yourdomain.com` points to it.

---

## Configure Twilio (same for A or B)

1. Open **[Twilio Console](https://console.twilio.com/)** and sign in.

2. Go to **Phone Numbers** → **Manage** → **Active numbers**, and click your phone number (the toll-free one).

3. Scroll to **Messaging configuration**.

4. Under **A MESSAGE COMES IN**:
   - Set **Webhook** (not “TwiML Bin” or “Function”).
   - **URL:** paste your full webhook URL, e.g.  
     `https://abc123def456.ngrok-free.app/api/webhooks/twilio/sms`  
     or  
     `https://api.yourdomain.com/api/webhooks/twilio/sms`
   - **HTTP method:** **POST**.

5. Click **Save** at the bottom.

Twilio will now send a POST request to that URL whenever someone sends an SMS to that number.

---

## Verify

1. **API and tunnel running**  
   - API: `uv run uvicorn app.main:app --reload --port 8000`  
   - Tunnel: ngrok or `cloudflared tunnel run locksmith-dev` (if using Cloudflare).

2. **Send a test SMS** to your Twilio number from your phone (e.g. “hello” or “Y $100” if you’re set up as a locksmith).

3. **Check:**
   - **Twilio Console** → **Monitor** → **Logs** → **Messaging**: the inbound message should show “Webhook delivered” (or similar) with status 200 if your API responded OK.
   - **Your API logs**: you should see the request and any log lines from the webhook handler (e.g. “no locksmith found” or “updated offer to ACCEPTED”).
   - **Your app’s messages table** (or Admin → Messages): a new inbound message row should appear.

If Twilio shows a webhook error (4xx/5xx or “could not reach”), the URL is wrong or your API/tunnel isn’t reachable. Double-check URL, tunnel, and that the API is listening on port 8000.

---

## Notes

- **ngrok free tier:** The hostname changes each time you restart ngrok. You’ll need to update the webhook URL in Twilio if you get a new URL.
- **Production:** Deploy your API (e.g. Fly.io) and set the webhook URL to your production API base + `/api/webhooks/twilio/sms`. No tunnel needed there.
