import { NextRequest, NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const {
        userId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        bio,
        qualifications,
        specializations,
        experience,
        preferredTimeSlots,
        languages,
        emergencyContact,
      } = body;

      if (!userId || !firstName || !lastName || !email || !phone || !dateOfBirth) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const trainerProfile = await TrainerProfileService.createTrainerProfile({
        userId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        bio,
        qualifications,
        specializations,
        experience,
        preferredTimeSlots,
        languages,
        emergencyContact,
      });

      return NextResponse.json({ success: true, trainerProfile });
    } catch (error) {
      console.error('Trainer profile creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const status = searchParams.get('status');
      const userId = searchParams.get('userId');
      const search = searchParams.get('search');
      const active = searchParams.get('active');

      if (status) {
        const profiles = await TrainerProfileService.getTrainerProfilesByStatus(
          status as 'active' | 'inactive' | 'on_leave' | 'terminated'
        );
        return NextResponse.json({ profiles });
      }

      if (userId) {
        const profile = await TrainerProfileService.getTrainerProfileByUserId(userId);
        if (!profile) {
          return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
        }
        return NextResponse.json({ profile });
      }

      if (search) {
        const profiles = await TrainerProfileService.searchTrainerProfiles(search);
        return NextResponse.json({ profiles });
      }

      if (active) {
        const profiles = await TrainerProfileService.getActiveTrainers();
        return NextResponse.json({ profiles });
      }

      const profiles = await TrainerProfileService.getAllTrainerProfiles();
      return NextResponse.json({ profiles });
    } catch (error) {
      console.error('Trainer profile fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
