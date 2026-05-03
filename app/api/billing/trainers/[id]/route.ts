import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/src/application/services/billing.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trainerBilling = await BillingService.getTrainerBillingById(params.id);

    if (!trainerBilling) {
      return NextResponse.json(
        { error: 'Trainer billing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trainerBilling });
  } catch (error) {
    console.error('Trainer billing fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      status,
      invoiceId,
      invoiceNumber,
      dueDate,
      paidAt,
      notes,
    } = body;

    const updated = await BillingService.updateTrainerBilling(params.id, {
      status,
      invoiceId,
      invoiceNumber,
      dueDate,
      paidAt,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer billing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trainerBilling: updated });
  } catch (error) {
    console.error('Trainer billing update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
