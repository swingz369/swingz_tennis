/**
 * GET /api/stripe/portal — Creates a Stripe Billing Portal session
 * Returns: { url: string }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { getStripe, STRIPE_CONFIGURED } from '@/lib/stripe/client';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:stripe:portal');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!STRIPE_CONFIGURED) {
      return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 503 });
    }

    const { user, supabase } = auth;
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const customerId = (profile as any)?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: 'Kein Stripe-Kunde gefunden. Bitte zuerst ein Abonnement starten.' },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe nicht verfügbar' }, { status: 503 });
    }

    const baseUrl = appBaseUrl();
    const returnPath = ['admin', 'superadmin'].includes(auth.role)
      ? `/${auth.role}/subscription`
      : '/dashboard';

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}${returnPath}`,
      });
      log.info('Stripe portal session created', { userId: user.id });
      return NextResponse.json({ url: portalSession.url });
    } catch (err) {
      log.error('Stripe portal session error', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Fehler beim Öffnen des Stripe-Portals' }, { status: 500 });
    }
  });
}
