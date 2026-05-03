import { NextRequest, NextResponse } from 'next/server';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trainerRate = await HourlyRateService.getTrainerHourlyRateById(params.id);

    if (!trainerRate) {
      return NextResponse.json(
        { error: 'Trainer hourly rate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trainerRate });
  } catch (error) {
    console.error('Trainer hourly rate fetch error:', error);
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
      overrideRate,
      validUntil,
      reason,
    } = body;

    const updated = await HourlyRateService.updateTrainerHourlyRate(params.id, {
      overrideRate,
      validUntil,
      reason,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer hourly rate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trainerRate: updated });
  } catch (error) {
    console.error('Trainer hourly rate update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await HourlyRateService.deleteTrainerHourlyRate(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Trainer hourly rate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trainer hourly rate delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
