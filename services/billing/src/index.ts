// services/billing/src/index.ts
import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:8000',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-key'
);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2023-10-16',
});

// Stripe Webhook Handler
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;

      // Update subscription in Supabase
      await supabase.from('subscriptions').upsert({
        user_id: session.client_reference_id,
        stripe_subscription_id: session.subscription,
        status: 'active',
        plan: session.metadata?.plan || 'basic',
      });

      // Cache invalidation
      await redis.del(`subscription:${session.client_reference_id}`);
      break;

    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
        })
        .eq('stripe_subscription_id', subscription.id);
      break;
  }

  res.json({ received: true });
});

// Create Checkout Session
app.post('/api/billing/checkout', async (req, res) => {
  const { userId, plan, tenantId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price:
            plan === 'premium' ? process.env.STRIPE_PREMIUM_PRICE : process.env.STRIPE_BASIC_PRICE,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      metadata: {
        tenantId,
        plan,
      },
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// Get Subscription Status
app.get('/api/billing/subscription/:userId', async (req, res) => {
  const { userId } = req.params;

  // Check Redis cache
  const cached = await redis.get(`subscription:${userId}`);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from Supabase
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !subscription) {
    return res.status(404).json({ error: 'No subscription found' });
  }

  // Cache for 5 minutes
  await redis.setex(`subscription:${userId}`, 300, JSON.stringify(subscription));

  res.json(subscription);
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Billing Service running on port ${PORT}`);
});
