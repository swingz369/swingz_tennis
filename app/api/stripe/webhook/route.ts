import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/infrastructure/external/supabase/server';

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const clubId = session.metadata?.clubId || 'demo-club';

      if (userId && session.subscription) {
        // Update user with subscription info
        await supabase
          .from('users')
          .update({
            subscription_tier: 'pro', // oder aus priceId ableiten
            subscription_status: 'active',
            stripe_subscription_id: session.subscription as string,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        // Audit log
        console.log(`✅ Subscription created for user ${userId}, club ${clubId}`);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as any).subscription as string | undefined;
      if (subscriptionId && invoice.customer) {
        const { data: users } = await supabase
          .from('users')
          .select('id, subscription_status')
          .eq('stripe_customer_id', invoice.customer as string);

        for (const user of users || []) {
          await supabase
            .from('users')
            .update({
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          console.log(`✅ Invoice paid for user ${user.id}`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.customer) {
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subscription.customer as string);

        for (const user of users || []) {
          await supabase
            .from('users')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          console.log(`❌ Subscription cancelled for user ${user.id}`);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', invoice.customer as string);

        for (const user of users || []) {
          await supabase
            .from('users')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          console.log(`⚠️ Payment failed for user ${user.id}`);
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
