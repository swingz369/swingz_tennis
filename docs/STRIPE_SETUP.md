# Stripe Setup Guide

> Zuletzt aktualisiert: 16.06.2026 (Stand der letzten Code-Änderung an diesem Dokument)

## Required Environment Variables

| Variable                             | Description                     | Example                        |
| ------------------------------------ | ------------------------------- | ------------------------------ |
| `STRIPE_SECRET_KEY`                  | Server-side secret key          | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET`              | Webhook endpoint signing secret | `whsec_...`                    |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side publishable key     | `pk_test_...` or `pk_live_...` |

## Local Development Setup

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Go to **Developers → API Keys** in the Stripe Dashboard
3. Copy the **Test mode** keys to `.env.local`:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

4. Set up a webhook endpoint (see below) and add the signing secret:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

## End-to-End Testing with Stripe CLI

### Prerequisites

- [Stripe CLI](https://stripe.com/docs/stripe-cli) installed (`stripe --version`)
- **Test mode** API keys in `.env.local` (Live keys won't work with `stripe listen`)
- Dev server running (`npm run dev`)

### Step 1: Authenticate Stripe CLI

```bash
stripe login
# Opens browser → authorize → done
```

Verify with:

```bash
stripe config --list
# Should show your account ID
```

### Step 2: Start Webhook Forwarding

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Forward Stripe events to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

> ⚠️ **Important:** The CLI outputs a **new** webhook signing secret (`whsec_...`). Copy this into `.env.local` as `STRIPE_WEBHOOK_SECRET` — the Dashboard secret won't work for local forwarding.

Restart the dev server after updating `.env.local`.

### Step 3: Trigger Test Events

```bash
# Terminal 3: Send test events

# Checkout completed (card payment)
stripe trigger checkout.session.completed

# Async payment cleared (SEPA)
stripe trigger payment_intent.succeeded

# Payment failed
stripe trigger payment_intent.payment_failed

# Refund
stripe trigger charge.refunded
```

### Step 4: Verify in Terminal 2

The `stripe listen` terminal shows every received event:

```
2026-06-16 18:00:00  --> checkout.session.completed [evt_abc123]
2026-06-16 18:00:00  <--  [200] OK
```

Status `200` = webhook processed successfully. Status `500` = check dev server logs.

### Step 5: Verify in Stripe Dashboard

https://dashboard.stripe.com/test/webhooks → click your endpoint → **Events** tab shows delivery details, response body, and retry history.

### Common Issues

| Problem                                 | Cause                             | Fix                                                                |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `403 Authorization failed`              | Using `sk_live_` key              | Switch to `sk_test_` in `.env.local`                               |
| `Invalid token id: tok_visa`            | Live key with `stripe trigger`    | Use test keys                                                      |
| `Webhook signature verification failed` | Wrong `STRIPE_WEBHOOK_SECRET`     | Use the secret from `stripe listen` output                         |
| Events fire but DB not updated          | Dev server not running or crashed | Check `npm run dev` terminal for errors                            |
| `No recognized ID in session metadata`  | Triggered event has no metadata   | Normal for `stripe trigger` — use real checkout flow for full test |

### Full E2E Test Flow (with real checkout)

```bash
# 1. Start everything
npm run dev          # Terminal 1
stripe listen --forward-to localhost:3000/api/webhooks/stripe  # Terminal 2

# 2. Update STRIPE_WEBHOOK_SECRET in .env.local from Terminal 2 output
# 3. Restart Terminal 1 (npm run dev)

# 4. Open http://localhost:3000 in browser
# 5. Create a booking → click Pay → complete Stripe checkout with test card:
#    Card: 4242 4242 4242 4242
#    Expiry: 12/34  CVC: 123  ZIP: 12345

# 6. Verify:
#    - Terminal 2 shows checkout.session.completed → 200
#    - Booking status updates to 'paid' in the app
#    - Notification appears
```

## Webhook Setup

### Local Development (Stripe CLI)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI will output a webhook signing secret (whsec_...)
# Add it to .env.local as STRIPE_WEBHOOK_SECRET
```

### Production (Stripe Dashboard)

1. Go to **Developers → Webhooks** in the Stripe Dashboard
2. Click **Add endpoint**
3. Set the URL to: `https://YOUR_DOMAIN/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the **Signing secret** and add it to your environment variables

## Vercel Deployment

Add the environment variables in **Vercel → Settings → Environment Variables**:

```
STRIPE_SECRET_KEY=sk_live_...        # Use LIVE keys for production
STRIPE_WEBHOOK_SECRET=whsec_...      # From your production webhook endpoint
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

> ⚠️ **Important**: Use `sk_live_` and `pk_live_` keys for production, NOT `sk_test_` keys.

## Graceful Degradation

The app handles missing Stripe keys gracefully:

- `lib/stripe/client.ts` — Returns `null` if keys are missing or match the placeholder prefix (`sk_test_51Qabc`). The checkout route returns a 503 error with a user-friendly message.
- `STRIPE_CONFIGURED` — Boolean flag you can check to conditionally show/hide payment UI.

## Checkout Flow

### Booking Payments

1. Member clicks "Pay" on a booking → `POST /api/stripe/checkout`
2. Server creates a Stripe Checkout Session → returns `{ url, sessionId }`
3. Member is redirected to Stripe-hosted checkout page
4. After payment, Stripe redirects to `/bookings?payment=success`
5. Webhook `checkout.session.completed` fires → booking marked as `paid`

### Invoice Payments

1. Member clicks "Pay" on an invoice → `POST /api/billing/invoices/[id]/checkout`
2. Server creates a Stripe Checkout Session → returns `{ checkoutUrl }`
3. After payment, webhook marks invoice as `paid` and creates payment record

### Shop Order Payments

1. Member completes checkout for shop items → `POST /api/stripe/checkout` with `type: 'shop'`
2. Webhook `checkout.session.completed` fires → order marked as `paid`, stock reduced

## Async Payment Methods (SEPA, iDEAL)

The webhook handler supports async payment methods:

- `checkout.session.completed` — Marks payment as `pending`
- `payment_intent.succeeded` — Promotes to `completed` when funds clear (2-8 days for SEPA)

## Testing

```bash
# Run Stripe webhook integration tests
npx vitest run src/__tests__/integration/stripe-webhook.test.ts
```

## Troubleshooting

| Issue                                          | Solution                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| "Zahlungsdienstleister ist nicht konfiguriert" | Set `STRIPE_SECRET_KEY` in `.env.local`                              |
| "STRIPE_SECRET_KEY is not configured"          | Ensure the key doesn't start with `sk_test_51Qabc` (placeholder)     |
| Webhook signature verification failed          | Ensure `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret |
| Payments not updating                          | Check webhook logs in Stripe Dashboard → Developers → Webhooks       |
