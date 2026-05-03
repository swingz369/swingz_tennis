import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/src/application/services/billing.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await BillingService.markTrainerBillingAsPaid(id);

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer billing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trainerBilling: updated });
  } catch (error) {
    console.error('Trainer billing payment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
