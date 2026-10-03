import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';
import { StripeConnectService } from '@/application/services/stripe-connect.service';

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

      const checkoutUrl = await new StripeConnectService(auth).createCheckoutSession(
        invoice.club_id,
        {
          lineItems: [
            {
              price_data: {
                currency: (invoice.currency || 'EUR').toLowerCase(),
                unit_amount: Math.round(invoice.amount * 100),
                product_data: { name: `Rechnung ${invoice.invoice_number}` },
              },
              quantity: 1,
            },
          ],
          metadata: { invoiceId },
          successUrl,
          cancelUrl,
          customerEmail: auth.user.email || undefined,
        }
      );

      return NextResponse.json({ checkoutUrl });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error creating Stripe Checkout session:', error);
      return internalErrorResponse();
    }
  });
}
