import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/src/application/services/billing.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      billingPeriodId,
      trainerId,
      trainerName,
      totalHours,
      hourlyRate,
      totalAmount,
      dueDate,
      notes,
    } = body;

    if (!billingPeriodId || !trainerId || !trainerName || !totalHours || !hourlyRate || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create trainer billing
    const trainerBilling = await BillingService.createTrainerBilling({
      billingPeriodId,
      trainerId,
      trainerName,
      totalHours,
      hourlyRate,
      totalAmount,
      dueDate,
      notes,
    });

    return NextResponse.json({ success: true, trainerBilling });
  } catch (error) {
    console.error('Trainer billing creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billingPeriodId = searchParams.get('billingPeriodId');
    const trainerId = searchParams.get('trainerId');
    const status = searchParams.get('status');
    const summary = searchParams.get('summary');

    if (summary && billingPeriodId) {
      const summary = await BillingService.calculateBillingSummary(billingPeriodId);
      return NextResponse.json({ summary });
    }

    if (billingPeriodId) {
      const trainerBillings = await BillingService.getTrainerBillingsByBillingPeriod(billingPeriodId);
      return NextResponse.json({ trainerBillings });
    }

    if (trainerId) {
      const trainerBillings = await BillingService.getTrainerBillingsByTrainerId(trainerId);
      return NextResponse.json({ trainerBillings });
    }

    if (status) {
      const trainerBillings = (await BillingService.getAllTrainerBillings()).filter(
        (b) => b.status === status
      );
      return NextResponse.json({ trainerBillings });
    }

    // Get all trainer billings
    const trainerBillings = await BillingService.getAllTrainerBillings();
    return NextResponse.json({ trainerBillings });
  } catch (error) {
    console.error('Trainer billing fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
