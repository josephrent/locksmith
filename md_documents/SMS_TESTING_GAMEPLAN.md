# SMS / Twilio Testing Game Plan

You have a toll-free number set up with Twilio. Use this plan to test the full text-messaging flow locally.

---

## 1. Prerequisites checklist

- [ ] **Twilio credentials in `apps/api/.env`**  
  You already have:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`  
  If your toll-free number is different from `+18447139232`, set `TWILIO_PHONE_NUMBER` to the toll-free number (e.g. `+18005551234`).

- [ ] **Webhook URL (only for testing inbound SMS)**  
  **Outbound SMS** (your API → Twilio → phone) works from localhost with no tunnel: your app calls Twilio’s API and the message is delivered.  
  **Inbound SMS** (someone replies to your toll-free number → Twilio → your API) requires a public URL so Twilio can POST to your webhook. For that you need a tunnel:
  - **Option A:** [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps) (see `CLOUDFLARE_QUICK_START.md`). Forward to your API port (e.g. 8000).
  - **Option B:** [ngrok](https://ngrok.com/) — e.g. `ngrok http 8000` → use the `https://xxxx.ngrok.io` URL.

  Webhook path: **`/api/webhooks/twilio/sms`**  
  Full URL example: `https://your-tunnel-host/api/webhooks/twilio/sms`

- [ ] **API and web app running**  
  - API: from `apps/api`, run `uv run uvicorn app.main:app --reload` (or your usual command). Default port 8000.
  - Web: from `apps/web`, run `npm run dev` (default port 3000).

- [ ] **At least one locksmith in the database**  
  For the “request → SMS to locksmiths” flow to work you need a locksmith with:
  - `is_active = true`
  - `is_available = true`
  - `primary_city` matching the city you’ll use in the test request
  - `supports_<service_type> = true` for the service you’ll request (e.g. `supports_home_lockout`)

- [ ] **Frontend URL**  
  In `.env`, `FRONTEND_URL` should match how the customer will open the app (e.g. `http://localhost:3000/` for local testing). The “View all quotes” link in the customer SMS uses this.

---

## 2. Configure Twilio to use your webhook

1. In [Twilio Console](https://console.twilio.com/), go to **Phone Numbers** → your toll-free number.
2. Under **Messaging** → **Configure with**:
   - **Webhooks, TwiML Bins, or Functions**
3. Under **A MESSAGE COMES IN**:
   - **Webhook**  
   - URL: `https://<your-tunnel-host>/api/webhooks/twilio/sms`  
   - Method: **POST**
4. Save.

Whenever someone sends an SMS to your toll-free number, Twilio will POST to that URL; your API will handle it in `apps/api/app/api/webhooks.py` (`twilio_sms_webhook`).

---

## 3. End-to-end test: customer request → locksmith reply → customer notified

This is the main flow to validate.

### Step 1: Start tunnel and services

1. Start your tunnel (Cloudflare or ngrok) so `https://<tunnel>/api/webhooks/twilio/sms` points to your local API.
2. Start API and web app.
3. Confirm Twilio webhook URL is set as in section 2.

### Step 2: Submit a customer request (outbound SMS)

1. Open the web app (e.g. `http://localhost:3000/request`).
2. Go through the flow:
   - Enter address (and validate location so `session.city` is set).
   - Accept SMS consent.
   - Select service type (e.g. Home Lockout) and complete step 2 (service selection).
3. On “service selected”, the API sends SMS to all available locksmiths for that city/service.

**Verify:**

- Locksmith phone(s) receive an SMS like:  
  `New Home Lockout request - Standard. Location: … Reply like this: Y $100 to quote, or N to decline`
- In Twilio Console → **Monitor** → **Logs** → **Messaging**, you see the outbound message.
- Optionally: Admin → Messages (or your SMS audit endpoint) shows the outbound record.

If no SMS is sent, check API logs for “Found 0 locksmiths” and fix city/service/availability (see Prerequisites).

### Step 3: Locksmith replies (inbound webhook)

From the **locksmith’s phone** (the number that received the offer), reply with one of:

- **Quote:** `Y $150` (or `Y 150`, `y $150`)  
  Expected: API receives webhook, updates the pending offer, sends the customer an SMS with “You’ve received a quote…” and the link to view quotes. Locksmith gets: “Quote received: $150.00. Customer will be notified.”
- **Decline:** `N` or `NO`  
  Expected: Offer marked declined; locksmith gets “Offer declined. Thank you for your response.”

**Verify:**

- Twilio Console → Messaging logs show the inbound message and your webhook returning 200 and TwiML.
- Customer (or the phone you used as customer in the request) receives the “Great news! You’ve received a quote…” SMS when you reply Y $price.
- Admin Messages (or DB) shows inbound + new outbound messages.

If the webhook is not hit, Twilio cannot reach your URL: recheck tunnel, URL in Twilio, and API port.

### Step 4: Optional – customer reply STOP

From the **customer’s phone**, send **STOP**.  
Expected: Reply like “You have been unsubscribed from SMS messages…”. No further marketing/service SMS to that number (per your logic).

---

## 4. Other flows to test (quick checks)

- **Locksmith commands** (from a number that is a locksmith in your DB):
  - **AVAILABLE** → “You’re now available for job offers.”
  - **UNAVAILABLE** → “You’ve paused job offers. Reply AVAILABLE to resume.”
  - **STOP** (locksmith) → “You’ve been deactivated. Contact support to reactivate.”
- **Unknown number** (not customer, not locksmith): reply anything → “Unknown number. Contact support if you’re a locksmith.”
- **Customer confirmation SMS**  
  When a job is created (e.g. after selecting a quote and completing booking), the customer should get: “Your locksmith request has been received! We’re finding someone to help you now.” (Triggered from `send_customer_confirmation` in `customer.py`.)

---

## 5. Troubleshooting

| Issue | What to check |
|-------|----------------|
| No SMS to locksmiths | Locksmith exists, same `primary_city`, correct `supports_*`, `is_active` and `is_available`; API logs for “Found N locksmiths”. |
| Twilio “webhook error” or no reply | Tunnel running and URL correct in Twilio; API logs for 4xx/5xx or exceptions in `twilio_sms_webhook`. |
| Customer doesn’t get “quote” SMS | Locksmith replied `Y $price`; `RequestSession` has `customer_phone`; `FRONTEND_URL` correct; check `send_sms` and exception logs in webhook. |
| Wrong number sending SMS | `TWILIO_PHONE_NUMBER` in `.env` must be your Twilio number (toll-free). Restart API after changing `.env`. |

---

## 6. Order of operations (summary)

**Outbound only (no tunnel):**  
1. Set `TWILIO_PHONE_NUMBER` to your toll-free number in `apps/api/.env`.  
2. Start API + web app.  
3. Ensure at least one locksmith exists and is available for the city/service you’ll test.  
4. Submit a request from the web app → locksmith/customer phone should receive SMS from your toll-free number.

**Full flow (including replies):**  
5. Start a tunnel; set Twilio webhook to `https://<tunnel>/api/webhooks/twilio/sms` (POST).  
6. Reply from locksmith phone: `Y $150` or `N` → customer gets quote SMS; Admin/Message log shows inbound + outbound.

After that, run through STOP, AVAILABLE/UNAVAILABLE, and customer confirmation SMS as needed.
