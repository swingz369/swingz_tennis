import { NextRequest, NextResponse } from 'next/server';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      baseRate,
      trainingTypes,
      experienceLevel,
    } = body;

    if (!name || !baseRate || !trainingTypes || !experienceLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create hourly rate tier
    const rateTier = await HourlyRateService.createHourlyRateTier({
      name,
      description,
      baseRate,
      trainingTypes,
      experienceLevel,
    });

    return NextResponse.json({ success: true, rateTier });
  } catch (error) {
    console.error('Hourly rate tier creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    if (active) {
      const rateTiers = await HourlyRateService.getActiveHourlyRateTiers();
      return NextResponse.json({ rateTiers });
    }

    // Get all hourly rate tiers
    const rateTiers = await HourlyRateService.getAllHourlyRateTiers();
    return NextResponse.json({ rateTiers });
  } catch (error) {
    console.error('Hourly rate tier fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
