import { NextRequest, NextResponse } from 'next/server';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';

export async function POST(___request: NextRequest) {
  try {
    const body = await __request.json();

    const {
      participant,
      scheduledDate,
      scheduledTime,
      duration,
      trainerId,
      courtId,
      notes,
    } = body;

    if (!participant || !scheduledDate || !scheduledTime || !duration || !trainerId || !courtId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create trial training
    const trialTraining = await TrialTrainingService.createTrialTraining({
      participant,
      scheduledDate,
      scheduledTime,
      duration,
      trainerId,
      courtId,
      notes,
    });

    return NextResponse.json({ success: true, trialTraining });
  } catch (error) {
    console.error('Trial training creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(___request: NextRequest) {
  try {
    const { searchParams } = new URL(__request.url);
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    const search = searchParams.get('search');
    const upcoming = searchParams.get('upcoming');
    const reminder = searchParams.get('reminder');

    if (status) {
      const trainings = await TrialTrainingService.getTrialTrainingsByStatus(
        status as any
      );
      return NextResponse.json({ trainings });
    }

    if (email) {
      const trainings = await TrialTrainingService.getTrialTrainingsByParticipantEmail(email);
      return NextResponse.json({ trainings });
    }

    if (search) {
      const trainings = await TrialTrainingService.searchTrialTrainings(search);
      return NextResponse.json({ trainings });
    }

    if (upcoming) {
      const days = parseInt(upcoming, 10) || 7;
      const trainings = await TrialTrainingService.getUpcomingTrialTrainings(days);
      return NextResponse.json({ trainings });
    }

    if (reminder) {
      const trainings = await TrialTrainingService.getTrialTrainingsNeedingReminder();
      return NextResponse.json({ trainings });
    }

    // Get all trial trainings
    const trainings = await TrialTrainingService.getAllTrialTrainings();
    return NextResponse.json({ trainings });
  } catch (error) {
    console.error('Trial training fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
