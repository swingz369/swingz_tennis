/**
 * POST /api/stripe/subscribe — Creates a Stripe Checkout Session for SaaS subscription
 * Body: { plan: PlanKey }
 * Returns: { url: string }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { getStripe, STRIPE_CONFIGURED } from '@/lib/stripe/client';
import { getPriceId, type PlanKey, type BillingInterval, BILLING_INTERVALS } from '@/lib/plans';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:stripe:subscribe');

const VALID_PLANS: PlanKey[] = ['solo_s', 'solo_l', 'school_s', 'school_l'];
const VALID_INTERVALS: BillingInterval[] = ['monthly', '6months', 'annual'];

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const body = await request.json().catch(() => null);
    const { plan, interval = 'monthly' } = (body ?? {}) as {
      plan?: PlanKey;
      interval?: BillingInterval;
    };

    if (!plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: 'Ungültiger Plan. Erlaubt: solo_s, solo_l, school_s, school_l' },
        { status: 400 }
      );
    }
    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json(
        { error: 'Ungültiges Intervall. Erlaubt: monthly, 6months, annual' },
        { status: 400 }
      );
    }

    // Role check: solo plans → admin only, school plans → superadmin only
    const role = auth.role;
    if (plan.startsWith('solo') && role !== 'admin') {
      return forbiddenResponse('Einzelverein-Pläne sind nur für Vereinsadmins');
    }
    if (plan.startsWith('school') && role !== 'superadmin') {
      return forbiddenResponse('Tennisschule-Pläne sind nur für Superadmins');
    }

    if (!STRIPE_CONFIGURED) {
      return NextResponse.json(
        { error: 'Stripe ist nicht konfiguriert. Bitte STRIPE_SECRET_KEY setzen.' },
        { status: 503 }
      );
    }

    const priceId = getPriceId(plan, interval);
    if (!priceId) {
      const intervalLabel = BILLING_INTERVALS[interval].label;
      return NextResponse.json(
        {
          error: `Stripe Preis-ID für Plan "${plan}" (${intervalLabel}) nicht konfiguriert.`,
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
      .select('email, full_name, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swingz.vercel.app';
    const returnPath = plan.startsWith('solo') ? '/admin/subscription' : '/superadmin/subscription';

    try {
      const customerId = (profile as any)?.stripe_customer_id as string | undefined;
      const baseSessionParams = {
        mode: 'subscription' as const,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}${returnPath}?success=1`,
        cancel_url: `${baseUrl}${returnPath}?cancelled=1`,
        metadata: { adminUserId: user.id, plan, interval, saasSubscription: 'true' },
      };
      const sessionParams = customerId
        ? { ...baseSessionParams, customer: customerId }
        : { ...baseSessionParams, customer_email: profile?.email ?? user.email ?? undefined };

      const session = await stripe.checkout.sessions.create(sessionParams);
      log.info('Stripe subscription session created', { plan, interval, sessionId: session.id });
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
