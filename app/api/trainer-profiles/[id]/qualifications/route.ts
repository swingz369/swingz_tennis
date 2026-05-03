import { NextRequest, NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();

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

    const updated = await TrainerProfileService.addQualification(id, {
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