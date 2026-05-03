import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { createStripeCheckoutSession } from '@/lib/stripe/stripe-client';

export async function POST(___request: NextRequest) {
  try {
    const { user } = await requireAuth();
    const body = await __request.json();

    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const invoice = await billingEngine.getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.member_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    const outstandingAmount = invoice.total_amount - invoice.paid_amount;

    if (outstandingAmount <= 0) {
      return NextResponse.json({ error: 'No outstanding amount' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing/cancel?invoice_id=${invoiceId}`;

    const checkoutUrl = await createStripeCheckoutSession({
      invoiceId: invoice.id,
      amount: outstandingAmount,
      currency: invoice.currency,
      description: `Invoice ${invoice.invoice_number}`,
      customerEmail: user.email || '',
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
