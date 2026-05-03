import { NextRequest, NextResponse } from 'next/server';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trialTraining = await TrialTrainingService.getTrialTrainingById(params.id);

    if (!trialTraining) {
      return NextResponse.json(
        { error: 'Trial training not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trialTraining });
  } catch (error) {
    console.error('Trial training fetch error:', error);
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

    const { status, notes, feedback, convertedToMemberId } = body;

    const updated = await TrialTrainingService.updateTrialTraining(params.id, {
      status,
      notes,
      feedback,
      convertedToMemberId,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Trial training not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trialTraining: updated });
  } catch (error) {
    console.error('Trial training update error:', error);
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
    const success = await TrialTrainingService.deleteTrialTraining(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Trial training not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trial training delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
