import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/src/application/services/billing.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await BillingService.markTrainerBillingAsPaid(params.id);

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
