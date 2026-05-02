import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { CreatePayment } from '@/lib/types/billing';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const { clubId, memberId, invoiceId, amount, paymentMethod, notes } = body;

    if (!clubId || !memberId || !amount || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const createPaymentData: CreatePayment = {
      club_id: clubId,
      member_id: memberId,
      invoice_id: invoiceId,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      notes,
    };

    const payment = await billingEngine.createPayment(createPaymentData);

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);

    const invoiceId = searchParams.get('invoiceId');
    const memberId = searchParams.get('memberId');

    if (invoiceId) {
      const payments = await billingEngine.getPaymentsByInvoice(invoiceId);
      return NextResponse.json({ payments });
    }

    if (memberId) {
      const payments = await billingEngine.getPaymentsByMember(memberId);
      return NextResponse.json({ payments });
    }

    return NextResponse.json(
      { error: 'Either invoiceId or memberId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting payments:', error);
    return NextResponse.json({ error: 'Failed to get payments' }, { status: 500 });
  }
}
