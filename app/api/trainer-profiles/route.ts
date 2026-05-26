import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

/**
 * POST /api/trainer-profiles
 * Create a new trainer profile in the trainer_profiles table.
 */
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { userId, firstName, lastName, email, phone, dateOfBirth } = body;

      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'No club selected' }, { status: 400 });
      }

      // Check if profile already exists
      const existing = await trainerProfileService.getTrainerProfileByUserId(userId);
      if (existing) {
        return NextResponse.json({ trainerProfile: existing });
      }

      // Fetch user data from Supabase to fill in profile
      const { data: userData } = await auth.supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', userId)
        .single();

      const nameParts = (userData?.full_name || firstName || '').split(' ');

      const profile = await trainerProfileService.createTrainerProfile({
        userId,
        clubId: clubId,
        firstName: nameParts[0] || firstName || '',
        lastName: nameParts.slice(1).join(' ') || lastName || '',
        email: userData?.email || email || '',
        phone: userData?.phone || phone || '',
        dateOfBirth: dateOfBirth || '1990-01-01',
      });

      return NextResponse.json({ success: true, trainerProfile: profile });
    } catch (error) {
      console.error('Trainer profile creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/trainer-profiles
 * Fetch trainer profiles for the current club from the trainer_profiles table.
 * Auto-creates profiles for trainers that exist in user_club_memberships but not yet in trainer_profiles.
 */
export async function GET(_request: NextRequest) {
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
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ profiles: [] });
      }

      // 1. Query real trainer_profiles for this club
      let profiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);

      // 2. Check for trainers in memberships that have no profile yet
      const { data: memberships } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id, created_at, is_active')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true);

      if (memberships && memberships.length > 0) {
        const existingUserIds = new Set(profiles.map((p) => p.userId));
        const missingUserIds = memberships
          .map((m: any) => m.user_id)
          .filter((uid: string) => !existingUserIds.has(uid));

        if (missingUserIds.length > 0) {
          // Fetch user details for missing profiles
          const { data: users } = await auth.supabase
            .from('users')
            .select('id, full_name, email, phone')
            .in('id', missingUserIds);

          const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

          // Auto-create missing profiles
          const newProfiles = await Promise.all(
            missingUserIds.map(async (userId: string) => {
              const user = usersMap.get(userId) as any;
              const nameParts = (user?.full_name || '').split(' ');

              try {
                return await trainerProfileService.createTrainerProfile({
                  userId,
                  clubId: clubId,
                  firstName: nameParts[0] || '',
                  lastName: nameParts.slice(1).join(' ') || '',
                  email: user?.email || '',
                  phone: user?.phone || '',
                  dateOfBirth: '1990-01-01',
                });
              } catch {
                // If creation fails (e.g. no club context in Drizzle), build stub for UI
                return {
                  id: userId,
                  userId,
                  firstName: nameParts[0] || '',
                  lastName: nameParts.slice(1).join(' ') || '',
                  email: user?.email || '',
                  phone: user?.phone || '',
                  dateOfBirth: '1990-01-01',
                  status: 'active' as const,
                  qualifications: [],
                  specializations: [],
                  experience: { years: 0, previousClubs: [], achievements: [] },
                  availability: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false,
                  },
                  preferredTimeSlots: [],
                  languages: ['Deutsch'],
                  emergencyContact: { name: '', phone: '', relationship: '' },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
              }
            })
          );

          profiles = [...profiles, ...newProfiles];
        }
      }

      // 3. Map membership active status for reference (memberships already filtered to is_active=true)
      const activeMembershipUserIds = new Set((memberships ?? []).map((m: any) => m.user_id));

      const enrichedProfiles = profiles.map((p) => {
        // If trainer is not in active memberships, mark as inactive
        if (!activeMembershipUserIds.has(p.userId) && p.status === 'active') {
          return { ...p, status: 'inactive' as const };
        }
        return p;
      });

      return NextResponse.json({ profiles: enrichedProfiles });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : '';
      console.error('Trainer profile fetch error:', message, stack);
      return NextResponse.json({ error: `Failed to load trainers: ${message}` }, { status: 500 });
    }
  });
}
