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

const log = createLogger('api:trainer-profiles:[id]');

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
      const trainerProfile = await new TrainerProfileService(auth).getTrainerProfileById(id);
      return NextResponse.json({ trainerProfile });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer profile fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
          return forbiddenResponse('Du kannst nur dein eigenes Profil bearbeiten');
        }
      }

      const body = await _request.json();

      const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        bio,
        profileImageUrl,
        qualifications,
        specializations,
        experience,
        status,
        hourlyRate: rawHourlyRate,
        contractedHourlyRate: rawContractedRate,
        extraHoursRate: rawExtraRate,
        availability,
        preferredTimeSlots,
        languages,
        emergencyContact,
      } = body;

      // ── Role-based field gating ─────────────────────────────────────────
      // hourly_rate (legacy) + contracted_hourly_rate: admin-only write
      // extra_hours_rate: admin AND trainer (own profile) may write
      let hourlyRate: number | undefined = undefined;
      let contractedHourlyRate: number | undefined = undefined;
      let extraHoursRate: number | undefined = undefined;

      if (rawHourlyRate !== undefined) {
        if (!isAdmin) {
          return forbiddenResponse('Nur Admins können den Stundensatz ändern');
        }
        if (
          rawHourlyRate !== null &&
          (typeof rawHourlyRate !== 'number' ||
            !Number.isFinite(rawHourlyRate) ||
            rawHourlyRate < 0)
        ) {
          return NextResponse.json({ error: 'Stundensatz muss ≥ 0 sein' }, { status: 400 });
        }
        hourlyRate = rawHourlyRate;
      }

      if (rawContractedRate !== undefined) {
        if (!isAdmin) {
          return forbiddenResponse('Nur Admins können den Vertragssatz ändern');
        }
        if (
          rawContractedRate !== null &&
          (typeof rawContractedRate !== 'number' ||
            !Number.isFinite(rawContractedRate) ||
            rawContractedRate < 0)
        ) {
          return NextResponse.json({ error: 'Vertragssatz muss ≥ 0 sein' }, { status: 400 });
        }
        contractedHourlyRate = rawContractedRate;
      }

      if (rawExtraRate !== undefined) {
        if (
          rawExtraRate !== null &&
          (typeof rawExtraRate !== 'number' || !Number.isFinite(rawExtraRate) || rawExtraRate < 0)
        ) {
          return NextResponse.json({ error: 'Zusatzstunden-Satz muss ≥ 0 sein' }, { status: 400 });
        }
        extraHoursRate = rawExtraRate;
      }

      const updated = await service.updateTrainerProfile(id, {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        bio,
        profileImageUrl,
        qualifications,
        specializations,
        experience,
        status,
        ...(hourlyRate !== undefined ? { hourlyRate } : {}),
        ...(contractedHourlyRate !== undefined ? { contractedHourlyRate } : {}),
        ...(extraHoursRate !== undefined ? { extraHoursRate } : {}),
        availability,
        preferredTimeSlots,
        languages,
        emergencyContact,
      });

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer profile update error:', error);
      return internalErrorResponse();
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const service = new TrainerProfileService(auth);

      if (!isAdmin) {
        const profile = await service.findTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('Du kannst nur dein eigenes Profil löschen');
        }
      }

      await service.deleteTrainerProfile(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer profile delete error:', error);
      return internalErrorResponse();
    }
  });
}
