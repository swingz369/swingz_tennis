import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  constructStripeEvent,
} from '@/lib/stripe/stripe-client';
import { billingEngine } from '@/lib/billing-engine';

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.text();
    const signature = _request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = constructStripeEvent(body, signature);

    console.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;

        if (!invoiceId) {
          console.error('No invoice ID in session metadata');
          return NextResponse.json({ error: 'No invoice ID' }, { status: 400 });
        }

        const invoice = await billingEngine.getInvoiceById(invoiceId);

        if (!invoice) {
          console.error(`Invoice ${invoiceId} not found`);
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const payment = await billingEngine.createPayment({
          club_id: invoice.club_id,
          member_id: invoice.member_id,
          invoice_id: invoiceId,
          amount: session.amount_total ? session.amount_total / 100 : 0,
          payment_method: 'stripe',
          transaction_id: session.payment_intent as string,
          stripe_payment_intent_id: session.payment_intent as string,
        });

        await billingEngine.updatePaymentStatus(payment.id, 'completed', {
          processed_at: new Date().toISOString(),
        });

        console.log(`Payment completed for invoice ${invoiceId}`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent failed:', paymentIntent.id);

        const payment = await billingEngine.getPaymentByStripeId(paymentIntent.id);

        if (payment) {
          await billingEngine.updatePaymentStatus(payment.id, 'failed', {
            failed_at: new Date().toISOString(),
            failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
          });
        }
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
