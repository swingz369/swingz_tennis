import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { createStripeCheckoutSession } from '@/lib/stripe/stripe-client';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:billing:invoices:[id]:checkout');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Members can checkout their own invoices
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id: invoiceId } = await params;

      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId ist erforderlich' }, { status: 400 });
      }

      const invoice = await billingEngine.getInvoiceById(invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }

      if (invoice.member_id !== auth.user.id) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }

      if (invoice.status === 'paid') {
        return NextResponse.json({ error: 'Rechnung ist bereits bezahlt' }, { status: 400 });
      }

      const baseUrl = appBaseUrl(_request.nextUrl.origin);
      const successUrl = `${baseUrl}/billing?payment=success`;
      const cancelUrl = `${baseUrl}/billing?payment=cancelled`;

      const checkoutData: {
        invoiceId: string;
        amount: number;
        currency: string;
        description: string;
        successUrl: string;
        cancelUrl: string;
        customerEmail?: string;
      } = {
        invoiceId,
        amount: invoice.amount,
        currency: invoice.currency || 'EUR',
        description: `Rechnung ${invoice.invoice_number}`,
        successUrl,
        cancelUrl,
      };

      if (auth.user.email) {
        checkoutData.customerEmail = auth.user.email;
      }

      const checkoutUrl = await createStripeCheckoutSession(checkoutData);

      return NextResponse.json({ checkoutUrl });
    } catch (error) {
      log.error('Error creating Stripe Checkout session:', error);
      return internalErrorResponse();
    }
  });
}
