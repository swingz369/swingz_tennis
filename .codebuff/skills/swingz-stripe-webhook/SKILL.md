---
name: swingz-stripe-webhook
description: SwingZ-specific knowledge for Stripe webhook handling — idempotency, signature verification, event types, and the billing service architecture.
---

# SwingZ Stripe Webhook

## Where it lives

- **Webhook endpoint:** `app/api/webhooks/stripe/route.ts` (POST)
- **Stripe client:** `lib/stripe/stripe-client.ts` (initialization, version pinning)
- **Webhook handler:** `lib/stripe/webhook-handlers.ts` (event router by type)
- **Billing service:** `lib/billing/season-billing.service.ts` (idempotent billing operations)
- **Dunning service:** `lib/billing/dunning.service.ts` (payment failure escalation)
- **Invoice PDF:** `lib/pdf/invoice-pdf.tsx` (serverless PDF generation)
- **Schema:** `subscriptions`, `invoices`, `payment_settings` tables in `src/infrastructure/persistence/schema.ts`

## Critical patterns (do NOT skip)

### 1. Signature verification

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20.acacia' });
const sig = req.headers.get('stripe-signature')!;
const body = await req.text(); // RAW body, not JSON!
const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
```

- **Always** use `req.text()` not `req.json()` — signature is over raw bytes
- **Never** log `body` — it contains sensitive payment data

### 2. Idempotency

Every webhook handler MUST be idempotent. Use the `stripe_events` table:

```typescript
const { data: existing } = await db
  .select()
  .from(stripeEvents)
  .where(eq(stripeEvents.id, event.id))
  .limit(1);
if (existing) return new Response('Already processed', { status: 200 });
// ... process ...
await db.insert(stripeEvents).values({ id: event.id, type: event.type, processed_at: new Date() });
```

### 3. Event types we handle

| Event                           | Handler                       | Action                                     |
| ------------------------------- | ----------------------------- | ------------------------------------------ |
| `customer.subscription.created` | `handleSubscriptionCreated`   | Insert into `subscriptions` table          |
| `customer.subscription.updated` | `handleSubscriptionUpdated`   | Update tier, period_end, status            |
| `customer.subscription.deleted` | `handleSubscriptionDeleted`   | Soft-delete (set `status='canceled'`)      |
| `invoice.payment_succeeded`     | `handlePaymentSucceeded`      | Mark invoice paid, extend period           |
| `invoice.payment_failed`        | `handlePaymentFailed`         | Trigger dunning (level 1: email)           |
| `checkout.session.completed`    | `handleCheckoutCompleted`     | Provision subscription, send welcome email |
| `payment_method.attached`       | `handlePaymentMethodAttached` | Save PM ID to `payment_settings`           |

### 4. Club-scope check

Webhooks are NOT user-scoped — they come from Stripe, not from an authenticated user. Always derive `club_id` from the `customer.metadata.club_id` field stored at checkout time.

## Sprint 3 fix (important!)

The P0-1 fix was: `season-billing.service.ts` had a fragile `ilike('notes', %seasonName%)` check for idempotency. It now uses an explicit `idempotency_key` column. **Never revert to the ilike check** — it caused double-billing in production.

## Testing

- **Mock:** `vi.mock('@/lib/stripe/stripe-client')` in unit tests
- **Signature:** Use `stripe.webhooks.generateTestHeaderString({ payload, secret })` to create valid sigs
- **E2E:** `e2e/billing-flow.test.ts` (if exists) — uses Stripe test mode + clock
- **Sandbox:** Use Stripe CLI `stripe trigger checkout.session.completed` for local testing

## Common tasks

### Add a new event type

1. Add handler to `lib/stripe/webhook-handlers.ts`
2. Add to the `switch(event.type)` router
3. Add to idempotency table check
4. Update `VERKAUFSBEREITSCHAFT.md` "Billing-Flow" section
5. Add test case with `stripe.webhooks.generateTestHeaderString`

### Debug a missing invoice

1. Check Sentry for `billing-webhook` errors
2. Check `stripe_events` table for `id, type, processed_at, error` — is the event there?
3. Check Vercel function logs for the webhook route
4. Stripe Dashboard → Events → verify delivery (200 OK?)
5. If 200 but no DB write: check idempotency table — was it marked processed before the write succeeded?

## Environment variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...  # exposed to client
STRIPE_API_VERSION=2024-11-20.acacia
```

## Gotchas

- **Vercel body size limit:** 4.5 MB. Stripe webhooks are tiny (always <100 KB) but watch for misuse.
- **Raw body requirement:** Next.js App Router gives `Request.text()` which is the raw body — perfect for signature verification.
- **Clock skew:** Use Stripe's `event.created` timestamp, not `new Date()`, for time-sensitive logic.
- **Retry behavior:** Stripe retries failed webhooks for 3 days. Always return 200 even on business-logic errors (and log to Sentry), or you'll get duplicate firings.
