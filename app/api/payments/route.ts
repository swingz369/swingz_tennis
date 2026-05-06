import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { CreatePayment } from '@/lib/types/billing';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

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
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);

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
  });
}
