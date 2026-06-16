import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructStripeEvent, stripe as getStripeClient } from '@/lib/stripe/stripe-client';
import { billingEngine } from '@/lib/billing-engine';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('webhook:stripe');

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.text();
    const signature = _request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const event = constructStripeEvent(body, signature);

    // ── Idempotency: atomic check-and-record (race-condition safe) ──
    const supabase = createServiceClient();
    try {
      // Cast needed until stripe_events table is in generated Supabase types
      const { data: isNew } = await (supabase as any)
        .rpc('check_and_record_stripe_event', {
          p_event_id: event.id,
          p_event_type: event.type,
        })
        .maybeSingle();

      if (isNew === false) {
        log.info('Event already processed — skipping', { eventId: event.id });
        return NextResponse.json({ received: true, deduplicated: true });
      }
    } catch (idempotencyError) {
      // Graceful degradation: if stripe_events table/RPC doesn't exist yet, continue processing
      log.warn('Idempotency check unavailable, processing anyway', {
        error:
          idempotencyError instanceof Error ? idempotencyError.message : String(idempotencyError),
      });
    }

    log.info('Received Stripe event', { type: event.type, eventId: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { invoiceId, bookingId, orderId, orderType } = session.metadata || {};

        // Handle shop orders
        if (orderType === 'shop' && orderId) {
          await handleShopOrderPayment(session, orderId);
        }
        // Handle invoice payments
        else if (invoiceId) {
          await handleInvoicePayment(session, invoiceId);
        }
        // Handle booking payments
        else if (bookingId) {
          await handleBookingPayment(session, bookingId);
        } else {
          log.error('No recognized ID in session metadata');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log.info('Payment intent succeeded', { paymentIntentId: paymentIntent.id });
        // SEPA Direct Debit payments arrive here (not via checkout.session.completed)
        // Look up the checkout session from the payment intent to find metadata
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        log.info('Charge refunded', { chargeId: charge.id });
        await handleChargeRefunded(charge);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // Look up payment by external_id (stripe payment intent id)
        const supabase = createServiceClient();
        const { data: payment } = await supabase
          .from('payments')
          .select('id')
          .eq('external_id', paymentIntent.id)
          .single();
        if (payment) {
          await billingEngine.updatePaymentStatus(payment.id, 'failed');
        }
        // Also try booking lookup via checkout session
        await handleBookingPaymentFailed(paymentIntent.id);
        break;
      }

      default:
        log.info('Unhandled event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Error handling Stripe webhook', error instanceof Error ? error : undefined);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Detects async payment methods (SEPA, iDEAL, etc.) */
function isAsyncPaymentMethod(session: Stripe.Checkout.Session): boolean {
  return (session.payment_method_types ?? []).some((t) =>
    ['sepa_debit', 'ideal', 'bancontact'].includes(t)
  );
}

// --- Invoice payment handling ---

async function handleInvoicePayment(session: Stripe.Checkout.Session, invoiceId: string) {
  const invoice = await billingEngine.getInvoiceById(invoiceId);
  if (!invoice) {
    log.error(`Invoice ${invoiceId} not found`);
    return;
  }

  const supabase = createServiceClient();
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('external_id', session.payment_intent as string)
    .maybeSingle();

  if (existingPayment) {
    log.info('Payment for session already processed — skipping', { sessionId: session.id });
    return;
  }

  const payment = await billingEngine.createPayment({
    invoice_id: invoiceId,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    payment_method: 'stripe',
    external_id: session.payment_intent as string,
  });

  // SEPA Direct Debit clears asynchronously (2-8 days).
  // Mark as 'pending' so payment_intent.succeeded can promote it later.
  const isAsync = isAsyncPaymentMethod(session);
  await billingEngine.updatePaymentStatus(payment.id, isAsync ? 'pending' : 'completed');
  log.info('Payment processed', { async: isAsync, invoiceId });
}

// --- Booking payment handling ---

async function handleBookingPayment(session: Stripe.Checkout.Session, bookingId: string) {
  const supabase = createServiceClient();
  const { userId, clubId } = session.metadata || {};

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, payment_status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    log.error(`Booking ${bookingId} not found`);
    return;
  }

  if (booking.payment_status === 'paid') {
    log.info('Booking already paid — skipping', { bookingId });
    return;
  }

  // SEPA: keep as 'pending' until payment_intent.succeeded fires
  const isAsyncBooking = isAsyncPaymentMethod(session);
  const bookingPaymentStatus = isAsyncBooking ? 'pending' : 'paid';
  const bookingStatus = isAsyncBooking ? 'pending' : 'confirmed';

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: bookingStatus, payment_status: bookingPaymentStatus })
    .eq('id', bookingId);

  if (bookingError) {
    log.error('Failed to update booking', bookingError instanceof Error ? bookingError : undefined);
    return;
  }

  // Only send success notification for sync methods (card).
  // For SEPA/async, the notification is sent from handlePaymentIntentSucceeded
  // when funds actually clear.
  if (userId && !isAsyncBooking) {
    await supabase.from('notifications').insert({
      user_id: userId,
      club_id: clubId || null,
      title: 'Zahlung erfolgreich',
      message: 'Deine Buchung wurde bezahlt und ist jetzt bestätigt.',
      type: 'booking',
      action_url: '/bookings',
    });
  } else if (userId && isAsyncBooking) {
    await supabase.from('notifications').insert({
      user_id: userId,
      club_id: clubId || null,
      title: 'Buchung eingegangen',
      message:
        'Deine Buchung wurde registriert. Die Zahlung wird verarbeitet und bestätigt, sobald der Geldeingang erfolgt ist.',
      type: 'booking',
      action_url: '/bookings',
    });
  }
}

// --- Shop order payment handling ---

async function handleShopOrderPayment(session: Stripe.Checkout.Session, orderId: string) {
  const supabase = createServiceClient();

  // Check for idempotency
  const { data: order } = await supabase
    .from('shop_orders')
    .select('id, status, payment_status, items')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    log.error(`Shop order ${orderId} not found`);
    return;
  }

  if (order.payment_status === 'paid') {
    log.info('Shop order already paid — skipping', { orderId });
    return;
  }

  // SEPA: keep as 'pending' until payment_intent.succeeded fires
  const shopPaymentStatus = isAsyncPaymentMethod(session) ? 'pending' : 'paid';

  // Mark payment status; fulfillment starts at 'pending'
  const { error: updateError } = await supabase
    .from('shop_orders')
    .update({
      status: 'pending',
      payment_status: shopPaymentStatus,
    })
    .eq('id', orderId);

  if (updateError) {
    log.error(
      'Failed to update shop order',
      updateError instanceof Error ? updateError : undefined
    );
    return;
  }

  // Only reduce stock for sync methods (card). For SEPA/async, stock is
  // reduced in handlePaymentIntentSucceeded when funds actually clear.
  const isAsyncShop = isAsyncPaymentMethod(session);
  if (!isAsyncShop) {
    const items = (order.items as any[]) || [];
    for (const item of items) {
      if (!item.product_id || !item.quantity) continue;
      await (supabase as any)
        .from('shop_products')
        .update({ stock: (supabase as any).raw(`stock - ${item.quantity}`) })
        .eq('id', item.product_id)
        .gte('stock', item.quantity);
    }
  }

  log.info('Shop order payment processed', { orderId, async: isAsyncShop });
}

/**
 * Safety-net handler for payment_intent.succeeded.
 *
 * For synchronous methods (card), checkout.session.completed already
 * creates the payment and marks entities as paid. This handler is a no-op in
 * that case (the payment is already 'completed').
 *
 * For async methods (SEPA Direct Debit), checkout.session.completed fires when
 * the customer authorizes but funds take 2–8 days to clear. This handler
 * promotes any still-pending payments to 'completed' once funds arrive.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = createServiceClient();

  // Find the payment record created by checkout.session.completed
  const { data: payment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('external_id', paymentIntent.id)
    .maybeSingle();

  if (!payment) {
    log.info('No payment record for PI — likely already handled', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  if (payment.status === 'completed') {
    // Already completed (card/sofort) — nothing to do
    return;
  }

  // SEPA or other async method: promote to completed
  await billingEngine.updatePaymentStatus(payment.id, 'completed');
  log.info('Payment promoted to completed (SEPA async)', { paymentId: payment.id });

  // Also update associated booking/shop order if still pending
  const stripeClient = getStripeClient();
  const sessions = await stripeClient.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  });

  const session = sessions.data[0];
  if (!session?.metadata) return;

  const { bookingId, orderId, orderType } = session.metadata;

  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('payment_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (booking && booking.payment_status !== 'paid') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId);

      // Notify member that SEPA payment cleared
      const { userId, clubId } = session.metadata;
      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          club_id: clubId || null,
          title: 'Zahlung eingegangen',
          message:
            'Deine SEPA-Zahlung wurde erfolgreich abgebucht. Deine Buchung ist jetzt bestätigt.',
          type: 'booking',
          action_url: '/bookings',
        });
      }
    }
  }

  if (orderType === 'shop' && orderId) {
    const { data: order } = await supabase
      .from('shop_orders')
      .select('payment_status')
      .eq('id', orderId)
      .maybeSingle();

    if (order && order.payment_status !== 'paid') {
      await supabase
        .from('shop_orders')
        .update({ status: 'pending', payment_status: 'paid' })
        .eq('id', orderId);
    }
  }
}

// Errors propagate to the outer POST handler which returns 500 to Stripe
// so Stripe will retry the webhook delivery.

/**
 * Handles charge.refunded events — marks the associated payment as refunded.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const supabase = createServiceClient();

  // Find the payment by external_id (payment intent)
  const paymentIntentId = charge.payment_intent as string;
  if (!paymentIntentId) return;

  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('external_id', paymentIntentId)
    .maybeSingle();

  if (payment) {
    await billingEngine.updatePaymentStatus(payment.id, 'refunded');
  }
}

async function handleBookingPaymentFailed(paymentIntentId: string) {
  const stripeClient = getStripeClient();
  const supabase = createServiceClient();

  try {
    const sessions = await stripeClient.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    const bookingId = sessions.data[0]?.metadata?.bookingId;
    if (bookingId) {
      await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
    }
  } catch (err) {
    log.error('handleBookingPaymentFailed error', err instanceof Error ? err : undefined);
  }
}
