import { NextRequest, NextResponse } from 'next/server';
import { TrainerAvailabilityService } from '@/src/application/services/trainer-availability.service';

export async function POST(___request: NextRequest) {
  try {
    const body = await __request.json();

    const {
      trainerId,
      date,
      startTime,
      endTime,
      status,
      notes,
      recurringPattern,
    } = body;

    if (!trainerId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create trainer availability
    const availability = await TrainerAvailabilityService.createTrainerAvailability({
      trainerId,
      date,
      startTime,
      endTime,
      status,
      notes,
      recurringPattern,
    });

    return NextResponse.json({ success: true, availability });
  } catch (error) {
    console.error('Trainer availability creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(___request: NextRequest) {
  try {
    const { searchParams } = new URL(__request.url);
    const trainerId = searchParams.get('trainerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const available = searchParams.get('available');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (available && startDate && startTime && endTime) {
      const availableTrainers = await TrainerAvailabilityService.getAvailableTrainers(
        startDate,
        startTime,
        endTime
      );
      return NextResponse.json({ availableTrainers });
    }

    if (trainerId) {
      const availabilities = await TrainerAvailabilityService.getTrainerAvailabilitiesByTrainerId(trainerId);
      return NextResponse.json({ availabilities });
    }

    // Query with filters
    const query: any = {};
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    if (status) query.status = status;

    const availabilities = await TrainerAvailabilityService.queryTrainerAvailabilities(query);
    return NextResponse.json({ availabilities });
  } catch (error) {
    console.error('Trainer availability fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
