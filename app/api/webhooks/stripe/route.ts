import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructStripeEvent, stripe as getStripeClient } from '@/lib/stripe/stripe-client';
import { billingEngine } from '@/lib/billing-engine';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.text();
    const signature = _request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const event = constructStripeEvent(body, signature);

    // ── Idempotency: atomic check-and-record (race-condition safe) ──
    const supabase = await createAdminClient();
    try {
      // Cast needed until stripe_events table is in generated Supabase types
      const { data: isNew } = await (supabase as any)
        .rpc('check_and_record_stripe_event', {
          p_event_id: event.id,
          p_event_type: event.type,
        })
        .maybeSingle();

      if (isNew === false) {
        console.log(`[Stripe Webhook] Event ${event.id} already processed — skipping`);
        return NextResponse.json({ received: true, deduplicated: true });
      }
    } catch (idempotencyError) {
      // Graceful degradation: if stripe_events table/RPC doesn't exist yet, continue processing
      console.warn(
        '[Stripe Webhook] Idempotency check unavailable, processing anyway:',
        idempotencyError
      );
    }

    console.log(`Received Stripe event: ${event.type} (${event.id})`);

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
          console.error('No recognized ID in session metadata');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // Look up payment by external_id (stripe payment intent id)
        const supabase = await createAdminClient();
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
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- Invoice payment handling ---

async function handleInvoicePayment(session: Stripe.Checkout.Session, invoiceId: string) {
  const invoice = await billingEngine.getInvoiceById(invoiceId);
  if (!invoice) {
    console.error(`Invoice ${invoiceId} not found`);
    return;
  }

  const supabase = await createAdminClient();
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('external_id', session.payment_intent as string)
    .maybeSingle();

  if (existingPayment) {
    console.log(`Payment for session ${session.id} already processed — skipping`);
    return;
  }

  const payment = await billingEngine.createPayment({
    invoice_id: invoiceId,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    payment_method: 'stripe',
    external_id: session.payment_intent as string,
  });
  await billingEngine.updatePaymentStatus(payment.id, 'completed');
  console.log(`Payment completed for invoice ${invoiceId}`);
}

// --- Booking payment handling ---

async function handleBookingPayment(session: Stripe.Checkout.Session, bookingId: string) {
  const supabase = await createAdminClient();
  const { userId, clubId } = session.metadata || {};

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, payment_status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    console.error(`[Stripe Webhook] Booking ${bookingId} not found`);
    return;
  }

  if (booking.payment_status === 'paid') {
    console.log(`[Stripe Webhook] Booking ${bookingId} already paid — skipping`);
    return;
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', bookingId);

  if (bookingError) {
    console.error('[Stripe Webhook] Failed to update booking:', bookingError);
    return;
  }

  if (userId) {
    await supabase.from('notifications').insert({
      user_id: userId,
      club_id: clubId || null,
      title: 'Zahlung erfolgreich',
      message: 'Deine Buchung wurde bezahlt und ist jetzt bestätigt.',
      type: 'booking',
      action_url: '/bookings',
    });
  }
}

// --- Shop order payment handling ---

async function handleShopOrderPayment(_session: Stripe.Checkout.Session, orderId: string) {
  const supabase = await createAdminClient();

  // Check for idempotency
  const { data: order } = await supabase
    .from('shop_orders')
    .select('id, status, payment_status, items')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    console.error(`[Stripe Webhook] Shop order ${orderId} not found`);
    return;
  }

  if (order.payment_status === 'paid') {
    console.log(`[Stripe Webhook] Shop order ${orderId} already paid — skipping`);
    return;
  }

  // Mark payment as complete; fulfillment status starts at 'pending'
  const { error: updateError } = await supabase
    .from('shop_orders')
    .update({
      status: 'pending',
      payment_status: 'paid',
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('[Stripe Webhook] Failed to update shop order:', updateError);
    return;
  }

  // Reduce stock for each item
  const items = (order.items as any[]) || [];
  for (const item of items) {
    if (!item.product_id || !item.quantity) continue;
    await (supabase as any)
      .from('shop_products')
      .update({ stock: (supabase as any).raw(`stock - ${item.quantity}`) })
      .eq('id', item.product_id)
      .gte('stock', item.quantity);
  }

  console.log(`[Stripe Webhook] Shop order ${orderId} payment completed`);
}

async function handleBookingPaymentFailed(paymentIntentId: string) {
  const stripeClient = getStripeClient();
  const supabase = await createAdminClient();

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
    console.error('[Stripe Webhook] handleBookingPaymentFailed error:', err);
  }
}
