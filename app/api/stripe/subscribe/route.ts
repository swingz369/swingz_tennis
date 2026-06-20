/**
 * POST /api/stripe/subscribe — Creates a Stripe Checkout Session for SaaS subscription
 * Body: { plan: 'starter' | 'professional' }
 * Returns: { url: string } — redirect to Stripe Checkout
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { getStripe, STRIPE_CONFIGURED } from '@/lib/stripe/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:stripe:subscribe');

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
};

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');

    if (!hasPermission) return forbiddenResponse('Nur Admins können ein Abonnement starten');

    if (!STRIPE_CONFIGURED) {
      return NextResponse.json(
        { error: 'Stripe ist nicht konfiguriert. Bitte STRIPE_SECRET_KEY setzen.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const { plan } = body ?? {};

    if (!plan || !['starter', 'professional'].includes(plan)) {
      return NextResponse.json(
        { error: 'Ungültiger Plan (starter oder professional)' },
        { status: 400 }
      );
    }

    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe Preis-ID für Plan "${plan}" nicht konfiguriert. STRIPE_${plan.toUpperCase()}_PRICE_ID setzen.`,
        },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe nicht verfügbar' }, { status: 503 });
    }

    const { user, supabase } = auth;

    const { data: profile } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swingz.vercel.app';

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: profile?.email ?? user.email ?? undefined,
        success_url: `${baseUrl}/admin/subscription?success=1`,
        cancel_url: `${baseUrl}/admin/subscription?cancelled=1`,
        metadata: { adminUserId: user.id, plan },
      });

      log.info('Stripe subscription session created', { plan, sessionId: session.id });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      log.error('Stripe subscription session error', err instanceof Error ? err : undefined);
      return NextResponse.json(
        { error: 'Stripe-Fehler beim Erstellen der Session' },
        { status: 500 }
      );
    }
  });
}
