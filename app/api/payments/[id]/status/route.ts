import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { PaymentStatus } from '@/lib/types/billing';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const {
        status,
        processedAt,
        failedAt,
        failureReason,
        refundedAt,
        refundAmount,
        refundReason,
      } = body;

      if (!status) {
        return NextResponse.json({ error: 'Status is required' }, { status: 400 });
      }

      const payment = await billingEngine.updatePaymentStatus(id, status as PaymentStatus, {
        processed_at: processedAt,
        failed_at: failedAt,
        failure_reason: failureReason,
        refunded_at: refundedAt,
        refund_amount: refundAmount,
        refund_reason: refundReason,
      });

      return NextResponse.json({ payment });
    } catch (error) {
      console.error('Error updating payment status:', error);
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }
  });
}
