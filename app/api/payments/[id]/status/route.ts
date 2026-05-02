import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { PaymentStatus } from '@/lib/types/billing';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const body = await request.json();
    
    const { status, processedAt, failedAt, failureReason, refundedAt, refundAmount, refundReason } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const payment = await billingEngine.updatePaymentStatus(
      params.id,
      status as PaymentStatus,
      {
        processed_at: processedAt,
        failed_at: failedAt,
        failure_reason: failureReason,
        refunded_at: refundedAt,
        refund_amount: refundAmount,
        refund_reason: refundReason,
      }
    );

    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json(
      { error: 'Failed to update payment status' },
      { status: 500 }
    );
  }
}
