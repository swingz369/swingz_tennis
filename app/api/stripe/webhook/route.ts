/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events.
 * - checkout.session.completed: confirms booking + payment
 * - payment_intent.payment_failed: marks booking payment as failed
 *
 * If Stripe is not configured the endpoint returns 200 immediately
 * (no-op) to avoid breaking anything.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createServerClient } from '@supabase/ssr';

/** Build a Supabase service-role-like client using the anon key (server-side only). */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function POST(_request: NextRequest) {
  const stripe = getStripe();

  // If Stripe is not configured, silently ack the webhook
  if (!stripe) {
    return NextResponse.json({ received: true, note: 'stripe_not_configured' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  try {
    const payload = await _request.text();
    const signature = _request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        // Unhandled event — still return 200 so Stripe doesn't retry
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: any) {
  const { bookingId, userId, clubId } = session.metadata || {};

  if (!bookingId) {
    console.warn('[Stripe Webhook] checkout.session.completed: no bookingId in metadata');
    return;
  }

  const supabase = getSupabaseAdmin();

  // Update booking: confirmed + paid
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
    })
    .eq('id', bookingId);

  if (bookingError) {
    console.error('[Stripe Webhook] Failed to update booking:', bookingError);
    return;
  }

  // Create a notification for the user if userId is present
  if (userId) {
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: userId,
      club_id: clubId || null,
      title: 'Zahlung erfolgreich',
      message: 'Deine Buchung wurde bezahlt und ist jetzt bestätigt.',
      type: 'booking',
      action_url: '/bookings',
    });

    if (notifError) {
      // Non-critical — log but don't fail
      console.warn('[Stripe Webhook] Could not create notification:', notifError.message);
    }
  }
}

async function handlePaymentFailed(paymentIntent: any) {
  // Try to find the booking via the checkout session metadata.
  // payment_intent.payment_failed doesn't carry custom metadata directly,
  // so we look up checkout sessions linked to this payment intent.
  const stripe = getStripe();
  if (!stripe) return;

  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1,
    });

    const checkoutSession = sessions.data[0];
    const bookingId = checkoutSession?.metadata?.bookingId;

    if (!bookingId) {
      console.warn('[Stripe Webhook] payment_intent.payment_failed: no bookingId found');
      return;
    }

    const supabase = getSupabaseAdmin();

    await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
  } catch (err) {
    console.error('[Stripe Webhook] handlePaymentFailed error:', err);
  }
}
