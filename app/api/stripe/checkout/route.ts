import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { createStripeCheckoutSession } from '@/lib/stripe/stripe-client';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const { invoiceId } = body;

      if (!invoiceId) {
        return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
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

      const outstandingAmount = invoice.total_amount - invoice.paid_amount;

      if (outstandingAmount <= 0) {
        return NextResponse.json({ error: 'No outstanding amount' }, { status: 400 });
      }

      // Get base URL from environment or use Vercel URL
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://swingz.vercel.app');
      const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/billing/cancel?invoice_id=${invoiceId}`;

      const checkoutUrl = await createStripeCheckoutSession({
        invoiceId: invoice.id,
        amount: outstandingAmount,
        currency: invoice.currency,
        description: `Invoice ${invoice.invoice_number}`,
        customerEmail: auth.user.email || '',
        successUrl,
        cancelUrl,
      });

      return NextResponse.json({ checkoutUrl });
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
  });
}
