import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { createStripeCheckoutSession } from '@/lib/stripe/stripe-client';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Members can checkout their own invoices
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id: invoiceId } = await params;

      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
      }

      const invoice = await billingEngine.getInvoiceById(invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (invoice.member_id !== auth.user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (invoice.status === 'paid') {
        return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || _request.nextUrl.origin;
      const successUrl = `${baseUrl}/billing/invoices/${invoiceId}?payment=success`;
      const cancelUrl = `${baseUrl}/billing/invoices/${invoiceId}?payment=cancelled`;

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
        amount: invoice.total_amount - invoice.paid_amount,
        currency: invoice.currency,
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
      console.error('Error creating Stripe Checkout session:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
