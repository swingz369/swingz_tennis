import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return stripeInstance;
}

export interface StripeCheckoutData {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(data: StripeCheckoutData): Promise<string> {
  const stripe = getStripeClient();
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card', 'sofort'],
    line_items: [
      {
        price_data: {
          currency: data.currency,
          product_data: {
            name: data.description,
            description: `Invoice ${data.invoiceId}`,
          },
          unit_amount: Math.round(data.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    metadata: {
      invoiceId: data.invoiceId,
    },
  };

  if (data.customerEmail) {
    sessionParams.customer_email = data.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return session.url || '';
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
      console.log(`Unhandled event type ${event.type}`);
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const invoiceId = session.metadata?.invoiceId;

  if (!invoiceId) {
    console.error('No invoice ID in session metadata');
    return;
  }

  const { billingEngine } = await import('../billing-engine');

  const payment = await billingEngine.createPayment({
    club_id: '', // Will be filled from invoice
    member_id: '', // Will be filled from invoice
    invoice_id: invoiceId,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    payment_method: 'stripe',
    transaction_id: session.payment_intent as string,
    stripe_payment_intent_id: session.payment_intent as string,
  });

  await billingEngine.updatePaymentStatus(payment.id, 'completed', {
    processed_at: new Date().toISOString(),
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log('Payment succeeded:', paymentIntent.id);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log('Payment failed:', paymentIntent.id);

  const { billingEngine } = await import('../billing-engine');

  const payment = await billingEngine.getPaymentByStripeId(paymentIntent.id);

  if (payment) {
    await billingEngine.updatePaymentStatus(payment.id, 'failed', {
      failed_at: new Date().toISOString(),
      failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
    });
  }
}

export function constructStripeEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export { getStripeClient as stripe };
