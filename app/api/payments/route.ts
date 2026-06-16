import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { CreatePayment } from '@/lib/types/billing';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payments');

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

      const { invoiceId, amount, paymentMethod } = body;

      if (!invoiceId || !amount || !paymentMethod) {
        return NextResponse.json(
          { error: 'Missing required fields (invoiceId, amount, paymentMethod)' },
          { status: 400 }
        );
      }

      const createPaymentData: CreatePayment = {
        invoice_id: invoiceId,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
      };

      const payment = await billingEngine.createPayment(createPaymentData);

      return NextResponse.json({ payment }, { status: 201 });
    } catch (error) {
      log.error('Error creating payment:', error);
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
        // memberId lookup not available directly via payments table (no member_id column).
        // Caller should use invoiceId instead, or resolve member→invoices first.
        return NextResponse.json(
          {
            error:
              'Use invoiceId to fetch payments. memberId lookup not available via payments route.',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Either invoiceId or memberId is required' },
        { status: 400 }
      );
    } catch (error) {
      log.error('Error getting payments:', error);
      return NextResponse.json({ error: 'Failed to get payments' }, { status: 500 });
    }
  });
}
