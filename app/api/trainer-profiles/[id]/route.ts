import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const trainerProfile = await trainerProfileService.getTrainerProfileById(id);

      if (!trainerProfile) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ trainerProfile });
    } catch (error) {
      console.error('Trainer profile fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const profile = await trainerProfileService.getTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('You can only edit your own profile');
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
        hourlyRate,
        contractedHourlyRate: rawContractedRate,
        extraHoursRate: rawExtraRate,
        availability,
        preferredTimeSlots,
        languages,
        emergencyContact,
      } = body;

      // ── Role-based field gating ─────────────────────────────────────────
      // contracted_hourly_rate: admin-only write
      // extra_hours_rate: admin AND trainer (own profile) may write
      let contractedHourlyRate: number | undefined = undefined;
      let extraHoursRate: number | undefined = undefined;

      if (rawContractedRate !== undefined) {
        if (!isAdmin) {
          return forbiddenResponse('Nur Admins können den Vertragssatz ändern');
        }
        if (
          rawContractedRate !== null &&
          (typeof rawContractedRate !== 'number' || rawContractedRate < 0)
        ) {
          return NextResponse.json({ error: 'Vertragssatz muss ≥ 0 sein' }, { status: 400 });
        }
        contractedHourlyRate = rawContractedRate;
      }

      if (rawExtraRate !== undefined) {
        if (rawExtraRate !== null && (typeof rawExtraRate !== 'number' || rawExtraRate < 0)) {
          return NextResponse.json({ error: 'Zusatzstunden-Satz muss ≥ 0 sein' }, { status: 400 });
        }
        extraHoursRate = rawExtraRate;
      }

      const updated = await trainerProfileService.updateTrainerProfile(id, {
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
        hourlyRate,
        ...(contractedHourlyRate !== undefined ? { contractedHourlyRate } : {}),
        ...(extraHoursRate !== undefined ? { extraHoursRate } : {}),
        availability,
        preferredTimeSlots,
        languages,
        emergencyContact,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      console.error('Trainer profile update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
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
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const profile = await trainerProfileService.getTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('You can only delete your own profile');
        }
      }

      const success = await trainerProfileService.deleteTrainerProfile(id);

      if (!success) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Trainer profile delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
