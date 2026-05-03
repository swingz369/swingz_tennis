import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { createStripeCheckoutSession } from '@/lib/stripe/stripe-client';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await request.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      );
    }

    const invoice = await billingEngine.getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.member_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Invoice is already paid' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const successUrl = `${baseUrl}/billing/invoices/${invoiceId}?payment=success`;
    const cancelUrl = `${baseUrl}/billing/invoices/${invoiceId}?payment=cancelled`;

    const checkoutUrl = await createStripeCheckoutSession({
      invoiceId,
      amount: invoice.total_amount - invoice.paid_amount,
      currency: invoice.currency,
      description: `Rechnung ${invoice.invoice_number}`,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
