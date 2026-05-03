import { NextRequest, NextResponse } from 'next/server';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateTier = await HourlyRateService.getHourlyRateTierById(params.id);

    if (!rateTier) {
      return NextResponse.json(
        { error: 'Hourly rate tier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ rateTier });
  } catch (error) {
    console.error('Hourly rate tier fetch error:', error);
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
      name,
      description,
      baseRate,
      trainingTypes,
      experienceLevel,
      isActive,
    } = body;

    const updated = await HourlyRateService.updateHourlyRateTier(params.id, {
      name,
      description,
      baseRate,
      trainingTypes,
      experienceLevel,
      isActive,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Hourly rate tier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, rateTier: updated });
  } catch (error) {
    console.error('Hourly rate tier update error:', error);
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
    const success = await HourlyRateService.deleteHourlyRateTier(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Hourly rate tier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Hourly rate tier delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
