import { NextRequest, NextResponse } from 'next/server';
import { TrainerAvailabilityService } from '@/src/application/services/trainer-availability.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const availability = await TrainerAvailabilityService.getTrainerAvailabilityById(id);

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();

    const {
      date,
      startTime,
      endTime,
      status,
      notes,
    } = body;

    const updated = await TrainerAvailabilityService.updateTrainerAvailability(id, {
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await TrainerAvailabilityService.deleteTrainerAvailability(id);

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