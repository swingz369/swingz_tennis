import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import type { TrainerProfile } from '@/domain/entities/trainer.entity';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

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

      const clubId =
        auth.memberships.find(
          (m) =>
            m.club_id && (m.role === 'trainer' || m.role === 'admin' || m.role === 'superadmin')
        )?.club_id ?? null;
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
        phone: userData?.phone || phone || 'N/A', // Fallback: phone validation requires min 5 chars
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
      // Accept optional clubId query param (e.g. for season planning wizard)
      const { searchParams } = new URL(_request.url);
      const queryClubId = searchParams.get('clubId');

      // Determine target club with membership-based access check
      let clubId: string | null = null;
      if (queryClubId) {
        // Verify the user has trainer+ role in the requested club
        const hasAccess = auth.memberships.some(
          (m) =>
            m.club_id === queryClubId &&
            (m.role === 'trainer' || m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasAccess) {
          return forbiddenResponse('Kein Zugriff auf diesen Club');
        }
        clubId = queryClubId;
      } else {
        // Use the resolved club from auth context (deterministic, cookie-aware)
        clubId = auth.clubId;
      }

      if (!clubId) {
        return NextResponse.json({ profiles: [] });
      }

      // Create service client early — used for both Drizzle fallback and membership queries
      const serviceClient = createServiceClient();

      // 1. Query real trainer_profiles for this club
      //    Try Drizzle first; fall back to Supabase service client if Drizzle fails (stale socket)
      let profiles: TrainerProfile[];
      try {
        profiles = await trainerProfileService.getTrainerProfilesByClubId(clubId);
      } catch (drizzleErr) {
        console.warn(
          '[trainer-profiles GET] Drizzle query failed, falling back to service client:',
          drizzleErr instanceof Error ? drizzleErr.message : drizzleErr
        );
        const { data: fallbackRows, error: fallbackError } = await serviceClient
          .from('trainer_profiles')
          .select('*')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        if (fallbackError) {
          console.error(
            '[trainer-profiles GET] Service client fallback also failed:',
            fallbackError.message
          );
          profiles = [];
        } else {
          profiles = (fallbackRows ?? []).map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            dateOfBirth: row.dateOfBirth ?? row.date_of_birth ?? '1990-01-01',
            bio: row.bio ?? undefined,
            profileImageUrl: row.profileImageUrl ?? row.profile_image_url ?? undefined,
            qualifications: row.qualifications ?? [],
            specializations: row.specializations ?? [],
            experience: row.experience ?? { years: 0, previousClubs: [], achievements: [] },
            status: row.status ?? 'active',
            hourlyRate: row.hourlyRate ?? row.hourly_rate ?? undefined,
            availability: row.availability ?? {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false,
            },
            preferredTimeSlots: row.preferredTimeSlots ?? row.preferred_time_slots ?? [],
            languages: row.languages ?? ['Deutsch'],
            emergencyContact: row.emergencyContact ??
              row.emergency_contact ?? { name: '', phone: '', relationship: '' },
            createdAt: row.created_at ?? new Date().toISOString(),
            updatedAt: row.updated_at ?? new Date().toISOString(),
          }));
        }
      }

      // 2. Check for trainers in memberships that have no profile yet
      // Service client bypasses RLS (membership queries may be restricted)
      const { data: memberships, error: membershipError } = await serviceClient
        .from('user_club_memberships')
        .select('user_id, created_at, is_active')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true);

      if (membershipError) {
        console.error('[trainer-profiles GET] Membership query error:', membershipError.message);
      }

      if (memberships && memberships.length > 0) {
        const existingUserIds = new Set(profiles.map((p) => p.userId));
        const missingUserIds = memberships
          .map((m: any) => m.user_id)
          .filter((uid: string) => !existingUserIds.has(uid));

        if (missingUserIds.length > 0) {
          // Fetch user details for missing profiles
          const { data: users } = await serviceClient
            .from('users')
            .select('id, full_name, email, phone')
            .in('id', missingUserIds);

          const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

          // Auto-create missing profiles (with retry on transient errors)
          const newProfiles: TrainerProfile[] = [];
          for (const userId of missingUserIds) {
            const user = usersMap.get(userId) as any;
            const nameParts = (user?.full_name || '').split(' ');

            let created: TrainerProfile | null = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                created = await trainerProfileService.createTrainerProfile({
                  userId,
                  clubId: clubId,
                  firstName: nameParts[0] || '',
                  lastName: nameParts.slice(1).join(' ') || '',
                  email: user?.email || '',
                  phone: user?.phone || '000-0000000', // Fallback: phone validation requires min 5 chars
                  dateOfBirth: '1990-01-01',
                });
                break; // success
              } catch (createErr) {
                console.warn(
                  `[trainer-profiles GET] Auto-create attempt ${attempt + 1} failed for userId=${userId}:`,
                  createErr instanceof Error ? createErr.message : createErr
                );
                if (attempt === 0) {
                  // Wait briefly before retry (DB connection may be recovering)
                  await new Promise((r) => setTimeout(r, 500));
                }
              }
            }

            if (created) {
              newProfiles.push(created);
            } else {
              // Only show stubs for transient DB errors, NOT for ghost memberships (FK violation)
              // Ghost memberships (user_id not in users table) are data issues that should not
              // create phantom trainers in the UI.
              const isGhost = missingUserIds.includes(userId) && !user;
              if (!isGhost) {
                newProfiles.push({
                  id: `stub-${userId}`,
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
                });
              } else {
                console.warn(
                  `[trainer-profiles GET] Skipping ghost membership userId=${userId} (user not in users table)`
                );
              }
            }
          }

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
      console.error('[trainer-profiles GET] Error:', message, '\nStack:', stack, '\nRaw:', error);
      return NextResponse.json({ error: `Failed to load trainers: ${message}` }, { status: 500 });
    }
  });
}
