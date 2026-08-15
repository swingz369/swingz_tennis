import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-profiles:[id]:qualifications:[qualificationId]:verify');

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; qualificationId: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id, qualificationId } = await params;
      const body = await _request.json();
      const { verifiedBy } = body;

      if (!verifiedBy) {
        return NextResponse.json({ error: 'Verifiziert-von ist erforderlich' }, { status: 400 });
      }

      const updated = await trainerProfileService.verifyQualification(
        id,
        qualificationId,
        verifiedBy
      );

      if (!updated) {
        return NextResponse.json(
          { error: 'Trainer-Profil oder Qualifikation nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      log.error('Qualification verification error:', error);
      return internalErrorResponse();
    }
  });
}
