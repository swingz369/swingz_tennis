import { NextRequest, NextResponse } from 'next/server';
import { constructStripeEvent, handleStripeWebhook } from '@/lib/stripe/stripe-client';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = constructStripeEvent(payload, signature);

    await handleStripeWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
