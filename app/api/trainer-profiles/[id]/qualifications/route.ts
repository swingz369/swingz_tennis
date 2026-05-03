import { NextRequest, NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      name,
      issuer,
      issuedDate,
      expiryDate,
      certificateUrl,
    } = body;

    if (!name || !issuer || !issuedDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const updated = await TrainerProfileService.addQualification(params.id, {
      name,
      issuer,
      issuedDate,
      expiryDate,
      certificateUrl,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Trainer profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, trainerProfile: updated });
  } catch (error) {
    console.error('Qualification addition error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
