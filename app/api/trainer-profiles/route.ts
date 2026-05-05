import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/src/infrastructure/external/supabase/server';
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

      const isAdmin = auth.roles.includes('admin') || auth.roles.includes('superadmin');

      if (status) {
        let profiles = await TrainerProfileService.getTrainerProfilesByStatus(
          status as 'active' | 'inactive' | 'on_leave' | 'terminated'
        );
        if (isAdmin && auth.role !== 'superadmin' && profiles) {
          profiles = await filterProfilesByClub(profiles, auth.clubId);
        }
        return NextResponse.json({ profiles });
      }

      if (userId) {
        const profile = await TrainerProfileService.getTrainerProfileByUserId(userId);
        if (!profile) {
          return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
        }
        // Admin (non-super) can only view profiles from own club
        if (isAdmin && auth.role !== 'superadmin') {
          const userClub = await getUserClub(profile.userId);
          if (!userClub || userClub !== auth.clubId) {
            return forbiddenResponse('Cannot access trainer from different club');
          }
        }
        return NextResponse.json({ profile });
      }

      if (search) {
        let profiles = await TrainerProfileService.searchTrainerProfiles(search);
        if (isAdmin && auth.role !== 'superadmin' && profiles) {
          profiles = await filterProfilesByClub(profiles, auth.clubId);
        }
        return NextResponse.json({ profiles });
      }

      if (active) {
        let profiles = await TrainerProfileService.getActiveTrainers();
        if (isAdmin && auth.role !== 'superadmin' && profiles) {
          profiles = await filterProfilesByClub(profiles, auth.clubId);
        }
        return NextResponse.json({ profiles });
      }

      // GET all profiles
      let allProfiles = await TrainerProfileService.getAllTrainerProfiles();
      if (isAdmin && auth.role !== 'superadmin' && allProfiles) {
        allProfiles = await filterProfilesByClub(allProfiles, auth.clubId);
      }
      return NextResponse.json({ profiles: allProfiles });
    } catch (error) {
      console.error('Trainer profile fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

// Helper to filter trainer profiles by club membership
async function filterProfilesByClub(profiles: any[], clubId: string): Promise<any[]> {
  if (!profiles || !Array.isArray(profiles)) return profiles;
  // Need to filter profiles where trainer belongs to the club
  // Could query user_club_memberships
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('role', 'trainer')
    .eq('is_active', true);

  if (!memberships) return [];
  const trainerUserIds = new Set(memberships.map((m: any) => m.user_id));
  return profiles.filter((p) => trainerUserIds.has(p.userId));
}

async function getUserClub(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);
  return data?.[0]?.club_id || null;
}
