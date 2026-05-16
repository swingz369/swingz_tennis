import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';
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
      const trainerProfile = await TrainerProfileService.getTrainerProfileById(id);

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
        const profile = await TrainerProfileService.getTrainerProfileById(id);
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
        availability,
        preferredTimeSlots,
        languages,
        emergencyContact,
      } = body;

      const updated = await TrainerProfileService.updateTrainerProfile(id, {
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
        const profile = await TrainerProfileService.getTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('You can only delete your own profile');
        }
      }

      const success = await TrainerProfileService.deleteTrainerProfile(id);

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
