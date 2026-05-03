import { NextRequest, NextResponse } from 'next/server';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const trainerId = searchParams.get('trainerId');

    if (trainerId) {
      const history = await HourlyRateService.getRateHistoryForTrainer(trainerId);
      return NextResponse.json({ history });
    }

    // Get all rate history
    const history = await HourlyRateService.getAllRateHistory();
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Rate history fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
