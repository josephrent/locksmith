# Locksmith App — Architecture Explained

This document explains how the app is built, how the pieces talk to each other, and **what webhooks are and why they matter**. No prior knowledge of webhooks is assumed.

---

## 1. The Big Picture

The app is a **locksmith marketplace**: customers request help (e.g. lockout), the system finds locksmiths and gets quotes, and payments and status flow through the system.

There are **three ways people (or systems) interact** with the app:

| Who | How they interact | Example |
|-----|--------------------|--------|
| **Customer** | Web browser (Next.js app) | Submits a request, sees quotes, pays |
| **Admin** | Web browser (same app, admin area) | Manages jobs, locksmiths, views SMS log |
| **Locksmith** | **Text messages (SMS)** via Twilio | Receives “New job request…”, replies “Y $150” or “N” |

Everything these three do eventually goes through **one backend**: the **FastAPI API**. The API talks to:

- **PostgreSQL** — stores requests, jobs, locksmiths, offers, messages, etc.
- **Redis** — caching and coordination (e.g. dispatch locks)
- **Twilio** — sends and receives SMS
- **Stripe** — payments
- **Google Maps** — address validation (used by the API when the customer enters an address)

So at the highest level:

```
  Customer (browser)  ──┐
                        ├──►  FastAPI API  ──►  Postgres, Redis, Twilio, Stripe, Google
  Admin (browser)    ───┤
                        │
  Locksmith (SMS)   ────┘  (via Twilio)
```

The important idea: **the API is the single place that owns business logic and data.** The web app and SMS are two different “front doors” into that same API.

---

## 2. Normal Requests: “You Ask, the Server Answers”

In most of the app, interaction works the same way you’re used to on the web:

1. **Someone (browser or another service) sends a request** to the API: “Do this,” “Give me this data.”
2. **The API does work** (read/write DB, call Twilio or Stripe, etc.).
3. **The API sends a response** back to the caller: “Done,” or “Here’s the data.”

Example:

- **Customer** fills the request form and clicks “Continue.”
- The **Next.js app** sends an HTTP request to the API: `POST /api/customer/sessions` (or similar) with the address and service type.
- The **API** validates the address (Google Maps), creates a row in the database, and returns something like `{ "session_id": "..." }`.
- The **browser** gets that response and shows the next step.

So in this pattern:

- **Direction:** Caller → API → response back to caller.
- **Who starts it:** The **browser** (or the Next.js app on behalf of the user).

This is the usual “request/response” or “pull” model: **you ask, the server answers.**

---

## 3. The Problem: “Something Happened Somewhere Else”

Two critical things in this app **do not start in your app**:

1. **A locksmith replies to an SMS** (e.g. “Y $150” or “N”).  
   That reply goes to **Twilio’s phone number**, not to your server. Twilio receives the text; your API does not “see” it unless Twilio tells you.

2. **A payment succeeds or fails in Stripe.**  
   The customer pays on Stripe’s page or with Stripe’s UI. The **payment happens inside Stripe**. Your API doesn’t “see” it unless Stripe tells you.

So you have:

- **Twilio** — knows “someone just sent this SMS to our number.”
- **Stripe** — knows “this payment just succeeded or failed.”

Your API has to **react** to those events (e.g. update an offer when the locksmith texts “Y $150”, or mark a job paid when Stripe says “payment succeeded”). But your API is not the one receiving the SMS or processing the card — Twilio and Stripe are. So **they** need a way to **notify your API** when something happens.

That notification mechanism is a **webhook**.

---

## 4. What Is a Webhook? (Simple Explanation)

Think of it like this:

- **Normal request:** You call a company: “What’s my balance?” They answer. **You initiated** the call.
- **Webhook:** You give the company your phone number and say: “When my balance changes, **call me**.” Later, something happens on their side, and **they call you**. **They initiated** the call.

A **webhook** is exactly that in HTTP terms:

1. You give an external service (Twilio, Stripe, etc.) **a URL** that points to your API (e.g. `https://your-api.com/api/webhooks/twilio/sms`).
2. You say (via their dashboard or API): “When [this type of event] happens, **send an HTTP POST request to this URL**.”
3. When the event happens, **they** send the POST to your URL. Your API receives it, does whatever logic you coded (update DB, send another SMS, etc.), and returns a response (often “200 OK”).

So:

- **Direction:** External service → **your API** (they call you).
- **Who starts it:** The **external service** (Twilio or Stripe), when something happens on their side.

In other words: a webhook is a **callback** or **“reverse” request** — the outside world is **pushing** an event into your app instead of your app constantly asking “did anything happen?”

---

## 5. Why This Matters for Your App

- **Without webhooks:**  
  Twilio would receive “Y $150” and you’d have no way to know. Your database would never update the offer to “accepted” and the customer would never get the “You’ve received a quote” SMS. Same for Stripe: you wouldn’t know when a payment succeeded.

- **With webhooks:**  
  You register a URL with Twilio and Stripe. When an SMS arrives, Twilio POSTs to your URL with the message body and sender. When a payment completes, Stripe POSTs to your URL with the event. Your API then runs the logic (update offer, send SMS, mark job paid, etc.).

So webhooks are how **Twilio and Stripe push events into your system** so your API can react.

---

## 6. Architecture: Where Webhooks Fit

You can picture the flows like this.

### 6.1 Outbound: Your API Calls Twilio (Normal Request)

When a customer submits a request and selects a service, the API:

1. Finds available locksmiths.
2. For each locksmith, **calls Twilio’s API** (HTTP request from your server to Twilio): “Send this SMS to this number.”
3. Twilio sends the SMS to the locksmith’s phone.
4. Twilio responds to your API: “OK, message sent, here’s the message ID.”

So here **your API is the caller**; Twilio is the one that “answers.” This is normal request/response. No webhook involved yet.

```
  Customer submits request  →  Your API  →  “Send SMS to locksmith”  →  Twilio  →  SMS to phone
                                     ←  “OK, sent”  ←─────────────────────────────
```

### 6.2 Inbound: Locksmith Replies — Webhook

The locksmith replies “Y $150” **to the Twilio number**. Twilio receives that SMS. Twilio does **not** know your business logic; it only knows “someone sent this text to this number.” So Twilio is configured to:

- When **any** SMS comes in to that number → **POST** the message details to your URL:  
  `POST https://your-api.com/api/webhooks/twilio/sms`  
  with fields like: From, To, Body (“Y $150”), MessageSid, etc.

Your API has a **webhook handler** for that URL. It:

1. Receives the POST (Body, From, To, …).
2. Figures out which locksmith sent it (lookup by From phone).
3. Finds the pending offer for that locksmith.
4. Updates the offer to “accepted” with the quoted price, updates the DB.
5. Sends an SMS to the customer (“You’ve received a quote…”).
6. Returns TwiML (or plain 200) so Twilio knows the webhook succeeded.

So the **initiator** of this HTTP request is **Twilio**, not the browser. That’s the webhook.

```
  Locksmith texts “Y $150”  →  Twilio  →  POST /api/webhooks/twilio/sms  →  Your API
                                                                              │
                                                                              ├─ Update offer in DB
                                                                              ├─ Send SMS to customer
                                                                              └─ Return 200 + TwiML
```

### 6.3 Stripe Payments — Webhook

Similarly:

- Customer pays on Stripe (Stripe’s page or embedded UI). **Stripe** processes the payment.
- Stripe is configured to send **webhooks** to your URL when events happen, e.g. `payment_intent.succeeded` or `charge.refunded`.
- Your API has `POST /api/webhooks/stripe`. When Stripe POSTs there, your handler:
  - Verifies the request really came from Stripe (signature).
  - Updates the job/payment state in the DB (e.g. “paid” or “refunded”).
  - Returns 200 so Stripe knows you received the event.

Again: **Stripe** starts the HTTP request to your API. That’s the webhook.

```
  Customer pays on Stripe  →  Stripe  →  POST /api/webhooks/stripe  →  Your API
                                                                          │
                                                                          └─ Update job/payment in DB, return 200
```

---

## 7. Summary Table

| Flow | Who starts the HTTP request? | Direction | Purpose |
|------|-----------------------------|-----------|---------|
| Customer submits request | Browser / Next.js | Browser → Your API | Create session, validate address, etc. |
| Admin views jobs | Browser | Browser → Your API | List/update jobs, locksmiths, messages |
| API sends SMS to locksmith | Your API | Your API → Twilio | Send “New job request…” |
| Locksmith replies “Y $150” | **Twilio** | **Twilio → Your API** (webhook) | Notify your API so it can update offer and notify customer |
| Payment succeeds | **Stripe** | **Stripe → Your API** (webhook) | Notify your API so it can mark job paid / handle refunds |

---

## 8. One More Detail: Webhooks Must Be Reachable

Twilio and Stripe run on **their** servers. To send a webhook, they need to send an HTTP request **to a URL that reaches your API**.

- If your API runs only on **localhost** (your machine), that URL is not reachable from the internet. So Twilio/Stripe **cannot** call your webhook when you’re developing locally, unless you expose your machine (e.g. with a **tunnel** like ngrok or Cloudflare Tunnel) and give them that public URL.
- In **production**, your API has a public URL (e.g. on Fly.io or Railway), so you configure that URL in Twilio and Stripe as the webhook endpoint.

That’s why the SMS testing guide says: **outbound** SMS (your API → Twilio → phone) works from localhost, but **inbound** SMS (locksmith replies → Twilio → **your webhook**) only works when Twilio can reach that URL (tunnel in dev, or production URL in prod).

---

## 9. Code Locations (Quick Reference)

- **Webhook URL handlers:** `apps/api/app/api/webhooks.py`
  - `POST /api/webhooks/twilio/sms` — inbound SMS (locksmith replies, customer STOP, etc.)
  - `POST /api/webhooks/stripe` — Stripe payment/refund events
- **API that your app and admin call:** `apps/api/app/api/` (e.g. `customer.py`, `admin/`)
- **SMS sending (outbound):** `apps/api/app/services/sms_service.py` (used by customer flow and dispatch)
- **Main app entry:** `apps/api/app/main.py` (mounts routers, including webhooks)

If you want to trace “what happens when a locksmith texts Y $150,” start at `webhooks.py` in the `twilio_sms_webhook` function and follow the offer-update and customer-SMS logic from there.
