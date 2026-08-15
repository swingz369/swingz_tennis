import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import type { TrainerProfile } from '@/domain/entities/trainer.entity';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-profiles');

/**
 * POST /api/trainer-profiles
 * Create a new trainer profile in the trainer_profiles table.
 */
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { userId, firstName, lastName, email, phone, dateOfBirth } = body;

      if (!userId) {
        return NextResponse.json({ error: 'userId ist erforderlich' }, { status: 400 });
      }

      const clubId =
        auth.memberships.find(
          (m) =>
            m.club_id && (m.role === 'trainer' || m.role === 'admin' || m.role === 'superadmin')
        )?.club_id ?? null;
      if (!clubId) {
        return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
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
      log.error('Trainer profile creation error:', error);
      return internalErrorResponse();
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
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
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
        log.warn(
          '[trainer-profiles GET] Drizzle query failed, falling back to service client:',
          drizzleErr instanceof Error ? drizzleErr.message : drizzleErr
        );
        const { data: fallbackRows, error: fallbackError } = await serviceClient
          .from('trainer_profiles')
          .select('*')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        if (fallbackError) {
          log.error(
            '[trainer-profiles GET] Service client fallback also failed:',
            fallbackError.message
          );
          profiles = [];
        } else {
          // ── NaN-Guard helper for Supabase PostgREST numeric coercion ───────
          // If the service-client fallback returns malformed numeric strings
          // (rare but observed on legacy rows: raw quotes, trailing junk),
          // parseFloat returns NaN, which the UI then renders as "NaN/h" in
          // the Stundensatz-Spalte. The helper collapses ANY non-finite input
          // (NaN / Infinity / non-numeric / null / undefined) to `null` —
          // explicit and idempotent. Mirrors parseNumericField in
          // trainer-profile.repository.ts#mapToEntity so the Drizzle path
          // and this PostgREST-fallback path produce the same entity shape.
          const parseNumOrNull = (raw: unknown): number | null => {
            if (raw == null) return null;
            // Runtime-Type-Check statt unsafe `as number` Cast. Number.isFinite(true)
            // ist true (coerced zu 1), und Number.isFinite({}) ist false — aber
            // ohne expliziten Type-Check landet ein slipped boolean oder object
            // unsauber im Number-Pfad. Mit dem expliziten Branch akzeptieren wir
            // nur `string` + `number`, alles andere kollabiert deterministisch auf null.
            if (typeof raw === 'string') {
              const n = parseFloat(raw);
              return Number.isFinite(n) ? n : null;
            }
            if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
            return null;
          };
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
            // Falls NaN/Infinity hier durchschlagen würden (PostgREST-malformed-number),
            // leiten wir auch das LEGACY `hourlyRate` durch den Helper. Konsistent mit
            // mapToEntity, das ALLE 3 Felder guarded. Das `?? undefined` am Ende erhält
            // den domain Type `?: number` (hourlyRate ist nicht nullable im Gegensatz zu
            // contracted/extra deren Type `?: number | null` ist).
            hourlyRate: parseNumOrNull(row.hourlyRate ?? row.hourly_rate) ?? undefined,
            // Sprint 4 Trainer Dual-Rate: ALSO map the two new columns in the
            // fallback path so the admin UI doesn't silently lose the contracted
            // rate (admin-editable) + extra-hours rate (trainer-editable) when
            // Drizzle throws (stale-socket fallback). See migration
            // supabase/migrations/20260610_add_trainer_dual_rate.sql and
            // TrainerProfile.$inferSelect for the canonical column names.
            //
            // Mirror the Drizzle `mapToEntity` coercion pattern (see
            // trainer-profile.repository.ts): Supabase PostgREST returns
            // `numeric(10, 2)` columns as strings. The helper `parseNumOrNull`
            // defined just above this `.map(...)` ALSO rejects non-finite
            // (NaN/Infinity) inputs — closing the gap that previously rendered
            // "NaN/h" in the UI for malformed legacy rows.
            contractedHourlyRate: parseNumOrNull(row.contracted_hourly_rate),
            extraHoursRate: parseNumOrNull(row.extra_hours_rate),
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
        log.error('[trainer-profiles GET] Membership query error:', membershipError.message);
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
                log.warn(
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
                log.warn(
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
      log.error(
        '[trainer-profiles GET] Error',
        error instanceof Error ? error : { message, stack }
      );
      return internalErrorResponse();
    }
  });
}
