import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; qualificationId: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id, qualificationId } = await params;
      const body = await _request.json();
      const { verifiedBy } = body;

      if (!verifiedBy) {
        return NextResponse.json({ error: 'Verified by is required' }, { status: 400 });
      }

      const updated = await TrainerProfileService.verifyQualification(
        id,
        qualificationId,
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
  });
}
