import Stripe from 'stripe';
import { createLogger } from '@/lib/logger';

const log = createLogger('stripe:client');
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }
  return stripeInstance;
}

export async function getStripeCheckoutSession(sessionId: string) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session;
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentFailed(failedPaymentIntent);
      break;
    default:
      log.info('Unhandled event type', { type: event.type });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const invoiceId = session.metadata?.invoiceId;

  if (!invoiceId) {
    log.error('No invoice ID in session metadata');
    return;
  }

  const { billingEngine } = await import('../billing-engine');

  const payment = await billingEngine.createPayment({
    invoice_id: invoiceId,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    payment_method: 'stripe',
    external_id: session.payment_intent as string,
  });

  await billingEngine.updatePaymentStatus(payment.id, 'completed');
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  log.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  log.info('Payment failed', { paymentIntentId: paymentIntent.id });

  const { billingEngine } = await import('../billing-engine');

  // Find payment by external_id (Stripe payment intent ID)
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();

  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('external_id', paymentIntent.id)
    .single();

  if (payment) {
    await billingEngine.updatePaymentStatus(payment.id, 'failed');
  }
}

export function constructStripeEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  // Zweiter Endpunkt in Stripe für Ereignisse verbundener Konten (Connect, ADR-008).
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    if (!connectSecret) throw error;
    return stripe.webhooks.constructEvent(payload, signature, connectSecret);
  }
}

export { getStripeClient as stripe };
