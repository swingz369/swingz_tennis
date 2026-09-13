import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { TrainerProfileService } from '@/application/services/trainer-profile.service';
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

      const updated = await new TrainerProfileService(auth).verifyQualification(
        id,
        qualificationId,
        verifiedBy
      );

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Qualification verification error:', error);
      return internalErrorResponse();
    }
  });
}
