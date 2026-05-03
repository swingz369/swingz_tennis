import { NextRequest, NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; qualificationId: string } }
) {
  try {
    const body = await request.json();
    const { verifiedBy } = body;

    if (!verifiedBy) {
      return NextResponse.json(
        { error: 'Verified by is required' },
        { status: 400 }
      );
    }

    const updated = await TrainerProfileService.verifyQualification(
      params.id,
      params.qualificationId,
      verifiedBy
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer profile or qualification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trainerProfile: updated });
  } catch (error) {
    console.error('Qualification verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
