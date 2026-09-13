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
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-profiles:[id]:qualifications');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const profile = await new TrainerProfileService(auth).getTrainerProfileById(id);
      return NextResponse.json({ qualifications: profile.qualifications || [] });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Qualifications fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const service = new TrainerProfileService(auth);

      if (!isAdmin) {
        const profile = await service.findTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse(
            'Du kannst nur Qualifikationen zu deinem eigenen Profil hinzufügen'
          );
        }
      }

      const body = await _request.json();
      const { name, issuer, issuedDate, expiryDate, certificateUrl } = body;

      if (!name || !issuer || !issuedDate) {
        return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
      }

      const updated = await service.addQualification(id, {
        name,
        issuer,
        issuedDate,
        expiryDate,
        certificateUrl,
      });

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Qualification addition error:', error);
      return internalErrorResponse();
    }
  });
}
