import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import type Stripe from 'stripe';
import { Resend } from 'resend';
import { constructStripeEvent, stripe as getStripeClient } from '@/lib/stripe/stripe-client';
import { billingEngine } from '@/lib/billing-engine';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import type { PlanKey } from '@/lib/plans';

// Reverse-map Stripe price ID → plan key
function priceToPlan(priceId: string): PlanKey | null {
  const map: Record<string, PlanKey> = {
    [process.env.STRIPE_PRICE_SOLO_S ?? '___']: 'solo_s',
    [process.env.STRIPE_PRICE_SOLO_L ?? '___']: 'solo_l',
    [process.env.STRIPE_PRICE_SCHOOL_S ?? '___']: 'school_s',
    [process.env.STRIPE_PRICE_SCHOOL_L ?? '___']: 'school_l',
    [process.env.STRIPE_STARTER_PRICE_ID ?? '___']: 'solo_s',
    [process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? '___']: 'solo_l',
  };
  return map[priceId] ?? null;
}

const log = createLogger('webhook:stripe');

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export async function POST(_request: NextRequest) {
  let reservedEventId: string | null = null;
  try {
    const body = await _request.text();
    const signature = _request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'stripe-signature-Header fehlt' }, { status: 400 });
    }

    const event = constructStripeEvent(body, signature);

    // ── Idempotency: atomic check-and-record (race-condition safe) ──
    const supabase = createServiceClient();
    try {
      // Cast needed until stripe_events table is in generated Supabase types
      const { data: isNew, error: reservationError } = await supabase
        .rpc('check_and_record_stripe_event', {
          p_event_id: event.id,
          p_event_type: event.type,
        })
        .maybeSingle();

      if (reservationError || typeof isNew !== 'boolean') {
        throw reservationError ?? new Error('Ungültige Antwort der Stripe-Event-Reservierung');
      }

      if (isNew === false) {
        log.info('Event already processed — skipping', { eventId: event.id });
        return NextResponse.json({ received: true, deduplicated: true });
      }
      reservedEventId = event.id;
    } catch (idempotencyError) {
      // Payment events must not be processed without the atomic deduplication guard.
      log.error(
        'Idempotency check unavailable — webhook will be retried',
        idempotencyError instanceof Error ? idempotencyError : undefined
      );
      return NextResponse.json({ error: 'Webhook vorübergehend nicht verfügbar' }, { status: 503 });
    }

    log.info('Received Stripe event', { type: event.type, eventId: event.id });

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { invoiceId, bookingId, orderId, orderType, saasSubscription, adminUserId, plan } =
          session.metadata || {};

        // SaaS subscription checkout
        if (saasSubscription === 'true' && adminUserId) {
          await handleSaasSubscription(session, adminUserId, plan as PlanKey | undefined);
        }
        // Handle shop orders
        else if (orderType === 'shop' && orderId) {
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

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleSaasInvoicePaymentFailed(invoice);
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
    // Die Reservierung liegt vor den fachlichen Schreibvorgängen. Bei einem
    // Fehler muss Stripe dieselbe Event-ID erneut zustellen können.
    if (reservedEventId) {
      try {
        const { error: releaseError } = await createServiceClient()
          .from('stripe_events')
          .delete()
          .eq('stripe_event_id', reservedEventId);
        if (releaseError) {
          log.error('Stripe-Event-Reservierung konnte nicht freigegeben werden', releaseError);
        }
      } catch (releaseError) {
        log.error(
          'Stripe-Event-Reservierung konnte nicht freigegeben werden',
          releaseError instanceof Error ? releaseError : undefined
        );
      }
    }
    return internalErrorResponse();
  }
}

/** Offered payment methods do not tell us whether this payment has settled. */
function isPaymentPending(session: Stripe.Checkout.Session): boolean {
  return session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required';
}

// --- Invoice payment handling ---

async function handleInvoicePayment(session: Stripe.Checkout.Session, invoiceId: string) {
  const invoice = await billingEngine.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error(`Rechnung ${invoiceId} nicht gefunden`);
  }

  const supabase = createServiceClient();
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from('payments')
    .select('id, status')
    .eq('external_id', session.payment_intent as string)
    .maybeSingle();

  if (existingPaymentError) {
    throw new Error(
      `Vorhandene Zahlung konnte nicht gelesen werden: ${existingPaymentError.message}`
    );
  }

  if (existingPayment) {
    const targetStatus = isPaymentPending(session) ? 'pending' : 'completed';
    if (existingPayment.status !== targetStatus && existingPayment.status !== 'completed') {
      await billingEngine.updatePaymentStatus(existingPayment.id, targetStatus);
    }
    log.info('Payment for session already exists', { sessionId: session.id });
    return;
  }

  let payment;
  try {
    payment = await billingEngine.createPayment({
      invoice_id: invoiceId,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      payment_method: 'stripe',
      external_id: session.payment_intent as string,
    });
  } catch (error) {
    // Paralleles Event hat die Zahlung schon angelegt (Unique-Index auf
    // Stripe-external_id) — dann ist dieses Event erledigt.
    const { data: raced } = await supabase
      .from('payments')
      .select('id')
      .eq('external_id', session.payment_intent as string)
      .maybeSingle();
    if (raced) {
      log.info('Payment created concurrently — skipping', { sessionId: session.id });
      return;
    }
    throw error;
  }

  // SEPA Direct Debit clears asynchronously (2-8 days).
  // Mark as 'pending' so payment_intent.succeeded can promote it later.
  const isAsync = isPaymentPending(session);
  await billingEngine.updatePaymentStatus(payment.id, isAsync ? 'pending' : 'completed');
  log.info('Payment processed', { async: isAsync, invoiceId });

  if (!isAsync && invoice.member_id) {
    const { data: memberData } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', invoice.member_id)
      .maybeSingle();

    if (memberData?.email) {
      const resend = getResend();
      const amount = session.amount_total ? (session.amount_total / 100).toFixed(2) : '?';
      await resend?.emails
        .send({
          from: process.env.EMAIL_FROM ?? 'SwingZ <noreply@swingz.cloud>',
          to: memberData.email,
          subject: `Zahlung eingegangen – Rechnung #${invoiceId}`,
          html: `<p>Hallo ${memberData.full_name ?? ''},</p><p>deine Zahlung von ${amount} € wurde erfolgreich verarbeitet. Danke!</p><p>Dein SwingZ-Team</p>`,
        })
        .catch((err) =>
          log.warn(
            'Zahlungsbestätigungs-Mail fehlgeschlagen',
            err instanceof Error ? err : undefined
          )
        );
    }
  }
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
    throw new Error(`Buchung ${bookingId} nicht gefunden`);
  }

  if (booking.payment_status === 'paid') {
    log.info('Booking already paid — skipping', { bookingId });
    return;
  }

  // SEPA: keep as 'pending' until payment_intent.succeeded fires
  const isAsyncBooking = isPaymentPending(session);
  const bookingPaymentStatus = isAsyncBooking ? 'pending' : 'paid';
  const bookingStatus = isAsyncBooking ? 'pending' : 'confirmed';

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: bookingStatus, payment_status: bookingPaymentStatus })
    .eq('id', bookingId);

  if (bookingError) {
    throw new Error(`Buchungszahlung konnte nicht gespeichert werden: ${bookingError.message}`);
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

    // Fetch user email for confirmation mail
    const { data: userData } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (userData?.email) {
      const resend = getResend();
      await resend?.emails
        .send({
          from: process.env.EMAIL_FROM ?? 'SwingZ <noreply@swingz.cloud>',
          to: userData.email,
          subject: 'Buchungsbestätigung – SwingZ',
          html: `<p>Hallo ${userData.full_name ?? ''},</p><p>deine Buchung wurde erfolgreich bezahlt und ist jetzt bestätigt.</p><p>Bis bald auf dem Platz!</p><p>Dein SwingZ-Team</p>`,
        })
        .catch((err) =>
          log.warn(
            'Buchungsbestätigungs-Mail fehlgeschlagen',
            err instanceof Error ? err : undefined
          )
        );
    }
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

  // Status und Bestand in einer Transaktion (DB-Funktion). Bestand wird erst
  // nach Geldeingang abgezogen — per Checkout-Event oder handlePaymentIntentSucceeded.
  const paid = !isPaymentPending(session);
  const { data, error } = await supabase.rpc('process_shop_order_payment', {
    p_order_id: orderId,
    p_paid: paid,
  });
  if (error) {
    throw new Error(`Shop-Zahlung konnte nicht gespeichert werden: ${error.message}`);
  }

  const result = data as { status: string; short_stock?: string[] } | null;
  if (result?.short_stock?.length) {
    log.error('Shop order paid but stock insufficient', {
      orderId,
      productIds: result.short_stock,
    });
  }
  log.info('Shop order payment processed', { orderId, status: result?.status });
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
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, status')
    .eq('external_id', paymentIntent.id)
    .maybeSingle();

  if (paymentError) throw new Error(`Zahlung konnte nicht gelesen werden: ${paymentError.message}`);

  // Booking and shop checkouts do not create an invoice payment row.
  // Their checkout metadata must still be processed when funds arrive.
  if (payment && payment.status !== 'completed') {
    // SEPA or other async method: promote to completed
    await billingEngine.updatePaymentStatus(payment.id, 'completed');
    log.info('Payment promoted to completed (SEPA async)', { paymentId: payment.id });
  }

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
    const { data: booking, error: bookingReadError } = await supabase
      .from('bookings')
      .select('payment_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingReadError) {
      throw new Error(`Buchung konnte nicht gelesen werden: ${bookingReadError.message}`);
    }
    if (!booking) throw new Error(`Buchung ${bookingId} nicht gefunden`);

    if (booking && booking.payment_status !== 'paid') {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId);
      if (bookingError)
        throw new Error(`Buchungsstatus konnte nicht gespeichert werden: ${bookingError.message}`);

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
    // Use the same fulfillment path so a PI arriving before the checkout
    // success event also decrements stock. The signed PI proves settlement.
    await handleShopOrderPayment({ ...session, payment_status: 'paid' }, orderId);
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

// --- SaaS subscription handlers ---

async function handleSaasSubscription(
  session: Stripe.Checkout.Session,
  userId: string,
  planHint?: PlanKey
) {
  const supabase = createServiceClient();
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  // Resolve plan from metadata hint or price ID
  let tier: PlanKey | null = planHint ?? null;
  if (!tier && subscriptionId) {
    const stripeClient = getStripeClient();
    const sub = await stripeClient.subscriptions.retrieve(subscriptionId);
    const priceId = sub.items.data[0]?.price.id;
    if (priceId) tier = priceToPlan(priceId);
  }

  if (!tier) {
    throw new Error(`Abo-Tarif für Nutzer ${userId} nicht ermittelbar`);
  }

  const { error } = await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', userId);

  // Der Kunde hat bezahlt. Schlägt das Update fehl, bleibt er trotzdem auf
  // 'free' und kommt nicht in seinen Verein — das darf nicht still passieren.
  // Genau so lief es bis zum 18.08.2026: der CHECK-Constraint kannte die
  // Plan-Keys nicht, und niemand hat den Fehler gelesen.
  if (error) {
    log.error(
      'SaaS subscription: Aktivierung konnte nicht gespeichert werden',
      new Error(error.message)
    );
    throw new Error(`Abo-Aktivierung fehlgeschlagen: ${error.message}`);
  }

  log.info('SaaS subscription activated', { userId, tier });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = sub.customer as string;
  const priceId = sub.items.data[0]?.price.id;
  const tier = priceId ? priceToPlan(priceId) : null;
  const periodEndRaw = (sub as any).current_period_end as number | undefined;
  const periodEnd = periodEndRaw ? new Date(periodEndRaw * 1000).toISOString() : null;

  const update: Record<string, string | null> = {
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd,
  };
  if (tier) update.subscription_tier = tier;

  const { error } = await supabase
    .from('users')
    .update(update as never)
    .eq('stripe_customer_id', customerId);

  // Siehe handleCheckoutCompleted: ein verschluckter Fehler bedeutet, dass der
  // Abo-Status in SwingZ und der bei Stripe auseinanderlaufen.
  if (error) {
    log.error(
      'SaaS subscription: Update konnte nicht gespeichert werden',
      new Error(error.message)
    );
    throw new Error(`Abo-Update fehlgeschlagen: ${error.message}`);
  }

  log.info('SaaS subscription updated', { customerId, tier, status: sub.status });
}

/** Dunning: notify the SaaS customer their subscription invoice failed. */
async function handleSaasInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string | null;
  if (!customerId) return;

  const supabase = createServiceClient();
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, full_name, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  // Not a SaaS-subscription customer (e.g. a club's own Stripe Connect invoice) — ignore.
  if (!userData?.id || !userData.stripe_subscription_id) return;

  await supabase.from('notifications').insert({
    user_id: userData.id,
    club_id: null,
    title: 'Zahlung fehlgeschlagen',
    message:
      'Die Zahlung für dein SwingZ-Abonnement konnte nicht verarbeitet werden. Bitte aktualisiere deine Zahlungsmethode, um den Zugriff nicht zu verlieren.',
    type: 'billing',
    action_url: '/admin/subscription',
  });

  if (userData.email) {
    const resend = getResend();
    await resend?.emails
      .send({
        from: process.env.EMAIL_FROM ?? 'SwingZ <noreply@swingz.cloud>',
        to: userData.email,
        subject: 'Zahlung fehlgeschlagen – SwingZ Abonnement',
        html: `<p>Hallo ${userData.full_name ?? ''},</p><p>die Zahlung für dein SwingZ-Abonnement ist fehlgeschlagen. Bitte aktualisiere deine Zahlungsmethode im Kundenportal, um deinen Zugriff nicht zu verlieren.</p><p>Dein SwingZ-Team</p>`,
      })
      .catch((err) =>
        log.warn(
          'Fehlgeschlagenen-Zahlungs-Mail konnte nicht versendet werden',
          err instanceof Error ? err : undefined
        )
      );
  }

  log.warn('SaaS invoice payment failed', { userId: userData.id, customerId });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = sub.customer as string;
  const { error } = await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      stripe_subscription_id: null,
    })
    .eq('stripe_customer_id', customerId);
  if (error) throw new Error(`Abo-Kündigung konnte nicht gespeichert werden: ${error.message}`);
  log.info('SaaS subscription deleted → reset to free', { customerId });
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
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', bookingId);
      if (error)
        throw new Error(
          `Fehlzahlung der Buchung konnte nicht gespeichert werden: ${error.message}`
        );
    }
  } catch (err) {
    log.error('handleBookingPaymentFailed error', err instanceof Error ? err : undefined);
    throw err;
  }
}
