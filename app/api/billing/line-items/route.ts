import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/src/application/services/billing.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trainerBillingId = searchParams.get('trainerBillingId');

    if (trainerBillingId) {
      const billingLineItems = await BillingService.getBillingLineItemsByTrainerBilling(trainerBillingId);
      return NextResponse.json({ billingLineItems });
    }

    // Get all billing line items
    const billingLineItems = await BillingService.getAllBillingLineItems();
    return NextResponse.json({ billingLineItems });
  } catch (error) {
    console.error('Billing line items fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
