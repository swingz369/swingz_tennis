import { NextRequest, NextResponse } from 'next/server';
import { TrainerAvailabilityService } from '@/src/application/services/trainer-availability.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const availability = await TrainerAvailabilityService.getTrainerAvailabilityById(params.id);

    if (!availability) {
      return NextResponse.json(
        { error: 'Trainer availability not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ availability });
  } catch (error) {
    console.error('Trainer availability fetch error:', error);
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
      date,
      startTime,
      endTime,
      status,
      notes,
    } = body;

    const updated = await TrainerAvailabilityService.updateTrainerAvailability(params.id, {
      date,
      startTime,
      endTime,
      status,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer availability not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, availability: updated });
  } catch (error) {
    console.error('Trainer availability update error:', error);
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
    const success = await TrainerAvailabilityService.deleteTrainerAvailability(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Trainer availability not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trainer availability delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
