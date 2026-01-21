# Stripe Connect Configuration — Locksmith Marketplace (No Deposit)

## Purpose
This document defines the **Stripe configuration, payment flows, and webhook requirements**
for the Locksmith Marketplace MVP using **Stripe Connect (Express accounts)**.

Key decisions:
- Stripe Connect is enabled from Day 1
- No deposits
- Customers pay the **full amount upfront**
- Funds are split between the platform and locksmith automatically
- Locksmiths are paid via Stripe payouts
- Admins manage onboarding and exceptions manually

---

## Stripe Connect Model (Locked)

### Connected Account Type
- **Express accounts**

Rationale:
- Stripe handles KYC, identity verification, and compliance
- Locksmiths complete onboarding via Stripe-hosted flow
- Platform retains control over charges, fees, and payouts
- Lowest operational overhead for MVP

---

## Payment Flow (No Deposit)

### High-Level Flow
1. Customer submits service request (steps 1 + 2)
2. Dispatch runs via SMS
3. Locksmith accepts job
4. Customer is prompted to pay **full estimated price**
5. Platform creates Stripe PaymentIntent
6. Payment succeeds
7. Job proceeds
8. Locksmith is paid automatically via Stripe payout

---

## Charge Type (Recommended)

### Destination Charges
- Charge is created on the **platform account**
- Locksmith’s connected account is set as the destination
- Platform collects an application fee

This is the simplest and most common marketplace pattern.

---

## Platform Fee Configuration

The platform must decide and configure:
- Percentage fee (e.g. 15–25%), OR
- Fixed fee (e.g. $20), OR
- Hybrid (e.g. 10% + $10)

This fee is passed to Stripe as:
- `application_fee_amount`

---

## Stripe Objects Used

### PaymentIntent
Used for customer payment.

Required fields:
- `amount` (full job price, in cents)
- `currency` (USD)
- `automatic_payment_methods.enabled = true`
- `application_fee_amount`
- `transfer_data.destination = <locksmith_stripe_account_id>`
- `metadata`:
  - `job_id`
  - `locksmith_id`
  - `customer_phone`
  - `service_type`
  - `city`

---

## Locksmith Onboarding (Admin-Driven)

### Admin Flow
1. Admin manually creates locksmith record in admin console
2. Platform creates Stripe **Express connected account**
3. Platform generates Stripe onboarding link
4. Admin sends onboarding link to locksmith (SMS or email)
5. Locksmith completes Stripe onboarding
6. Stripe updates account capabilities via webhook

### Required Locksmith Account States
- `charges_enabled`
- `payouts_enabled`
- `requirements.currently_due`

Only locksmiths with `payouts_enabled=true` should be eligible for automatic payouts.

---

## Required Database Fields

### locksmiths
- `stripe_account_id`
- `charges_enabled`
- `payouts_enabled`
- `stripe_requirements_json` (optional snapshot)
- `onboarded_at`

### jobs
- `estimated_price`
- `final_price` (optional)
- `stripe_payment_intent_id`
- `stripe_charge_id`
- `application_fee_amount`
- `assigned_locksmith_id`
- `payment_status`

---

## Webhooks (Critical)

Stripe webhooks are the **source of truth**.
Frontend success pages must not be trusted.

### Required Webhook Endpoint
- `POST /webhooks/stripe`

### Events to Subscribe To

#### Payments
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

#### Connected Accounts
- `account.updated`

#### Payouts
- `payout.created`
- `payout.updated`
- `payout.paid`
- `payout.failed`

---

## Webhook Handling Requirements

- Verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
- Store and deduplicate `event.id`
- Handle retries and out-of-order delivery
- Update job, payment, and locksmith states accordingly
- Log all events for audit/debugging

---

## Refunds

### When Refunds Occur
- Job canceled by admin
- Locksmith no-show
- Service could not be completed

### Refund Behavior
- Admin triggers refund manually from admin console
- Stripe processes refund
- `charge.refunded` webhook updates job/payment state

---

## Disputes / Chargebacks

- Listen for `charge.dispute.created`
- Flag job for admin review
- Preserve message logs, job timeline, and locksmith info
- No automatic resolution in MVP (manual ops)

---

## Stripe Environment Configuration

### Required Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_API_VERSION`

### Local Development
- Use Stripe CLI to forward webhooks to local API
- Separate test vs production environments

---

## Non-Goals (Explicit)

- No Stripe Checkout Sessions
- No deposits or authorization-only flows
- No instant payouts configuration initially
- No multi-currency support
- No automated dispute resolution

---

## Operational Notes

- Stripe Connect introduces additional compliance and payout delays
- Locksmith onboarding is heavier than cash-based models
- Manual admin oversight is expected in MVP
- Start with a small, trusted locksmith set

---

END STRIPE CONNECT SPEC
