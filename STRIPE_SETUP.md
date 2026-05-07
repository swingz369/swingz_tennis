# Stripe Setup Guide

This guide documents how to configure Stripe payments for SwingZ.

## Required Environment Variables

Add the following to your **Vercel project settings** (Settings → Environment Variables):

| Variable                             | Description                                  | Example                        |
| ------------------------------------ | -------------------------------------------- | ------------------------------ |
| `STRIPE_SECRET_KEY`                  | Stripe secret key (server-side only)         | `sk_live_...` or `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side)         | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET`              | Webhook signing secret from Stripe dashboard | `whsec_...`                    |
| `NEXT_PUBLIC_SITE_URL`               | Your production URL (used for redirect URLs) | `https://swingz.vercel.app`    |

## Graceful Fallback (No Stripe Configured)

The app works **without Stripe configured**. When `STRIPE_SECRET_KEY` is absent or starts with the placeholder `sk_test_51Qabc`, all booking payments are automatically marked as paid/confirmed without going through Stripe checkout.

This means:

- Development and demo environments work out of the box
- Bookings are created and confirmed immediately
- No payment errors are shown to users

## Setting Up Stripe Webhooks

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://swingz.vercel.app/api/stripe/webhook`
4. Select these events to listen for:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** and add it as `STRIPE_WEBHOOK_SECRET` in Vercel

## Local Development with Stripe CLI

To test webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will output a webhook signing secret — add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

## Payment Flow

1. User creates a booking via `/bookings`
2. If the booking requires payment (`payment_status = pending`, `requiresPayment = true`), the user is redirected to Stripe Checkout
3. After successful payment, Stripe sends a `checkout.session.completed` webhook
4. The webhook handler updates the booking to `status = confirmed, payment_status = paid`
5. A notification is created for the user
6. User is redirected to `/bookings?payment=success`

## Testing

Use Stripe test keys (`sk_test_...` / `pk_test_...`) and the test card `4242 4242 4242 4242` with any future expiry and CVC.
