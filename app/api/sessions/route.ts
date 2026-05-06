import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { createClient } from '@/infrastructure/external/supabase/server';
import type { BookingStatus } from '@/domain/entities/booking';
import { ClubId, TrainerId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { cache, CacheKeys, CacheTTL } from '@/lib/utils/cache';

const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();

// GET /api/sessions?clubId=xxx – Sessions für einen Club (buchbar)
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    // Members can view sessions
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    const url = new URL(req.url);
    const clubIdParam = url.searchParams.get('clubId');

    // Validate clubId is present
    if (!clubIdParam) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    // Optional: validate clubId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clubIdParam)) {
      return NextResponse.json({ error: 'Invalid club ID format' }, { status: 400 });
    }

    try {
      const clubId = ClubId.fromString(clubIdParam);

      // Use cache for schedule data (5 minute TTL)
      const schedule = await cache.getOrSet(
        CacheKeys.schedule(clubIdParam),
        () => scheduleRepo.findByClubId(clubId),
        CacheTTL.MEDIUM
      );

      if (!schedule) {
        return NextResponse.json([]);
      }

      const sessions = schedule.getSessions();

      // Collect all unique trainer IDs and fetch trainers in batch using findByIds
      const uniqueTrainerIds = Array.from(new Set(sessions.map((s) => s.trainerId)));

      // Fetch trainers in batch with caching (15 minute TTL for trainer data)
      const trainersMap = new Map<string, string>();
      if (uniqueTrainerIds.length > 0) {
        const trainers = await cache.getOrSet(
          CacheKeys.trainers(clubIdParam),
          () => trainerRepo.findByIds(uniqueTrainerIds),
          CacheTTL.LONG
        );
        trainers.forEach((trainer) => {
          trainersMap.set(trainer.trainerId.toString(), trainer.name);
        });
      }

      // Fetch current user's bookings for this club
      const userBookingsMap = new Map<string, { bookingId: string; status: BookingStatus }>();
      let bookingsError: string | null = null;

      try {
        const supabaseClient = await createClient();
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        if (user) {
          const { data: bookings, error: bookingsQueryError } = await supabaseClient
            .from('bookings')
            .select('id, session_id, status')
            .eq('member_id', user.id)
            .eq('club_id', clubId.getValue());

          if (bookingsQueryError) {
            throw bookingsQueryError;
          }

          if (bookings) {
            for (const b of bookings) {
              userBookingsMap.set(b.session_id, {
                bookingId: b.id,
                status: b.status as BookingStatus,
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch user bookings:', e);
        bookingsError = 'Failed to load booking status';
        // Continue execution but flag the error
      }

      const sessionsList = sessions.map((s) => {
        const ub = userBookingsMap.get(s.id);
        return {
          id: s.id,
          week: s.week.toString(),
          dayOfWeek: s.timeslot.getStart().getDay(),
          startTime: s.timeslot.getStart().toISOString().substring(11, 16),
          endTime: s.timeslot.getEnd().toISOString().substring(11, 16),
          trainerId: s.trainerId.toString(),
          trainerName: trainersMap.get(s.trainerId.toString()) || s.trainerId.toString(),
          groupIds: s.groupIds,
          maxParticipants: s.maxParticipants,
          notes: s.notes,
          clubId: schedule.getClubId().getValue(),
          scheduleId: schedule.getId().getValue(),
          bookedByUser: !!ub,
          bookingId: ub?.bookingId,
          bookingStatus: ub?.status,
        };
      });

      // Include partial error if bookings failed to load
      const response: any = {
        sessions: sessionsList,
      };

      if (bookingsError) {
        response.warnings = {
          bookings: bookingsError,
        };
      }

      return NextResponse.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// POST /api/sessions – Create a new session
export async function POST(req: NextRequest) {
  // SECURITY FIX: Add CSRF protection
  return withCSRFProtection(req, async () => {
    return withApiAuth(req, async (auth) => {
      // Only admins and trainers can create sessions
      const hasPermission = await verifyRole(auth, 'trainer');
      if (!hasPermission) {
        return forbiddenResponse('Trainer access required');
      }

      const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
      if (rateLimitError) {
        return rateLimitError;
      }

      try {
        const body = await req.json();
        const { dayOfWeek, startTime, endTime, trainerId, maxParticipants, notes, clubId } = body;

        // Validate required fields
        if (!dayOfWeek || !startTime || !endTime || !trainerId) {
          return NextResponse.json(
            { error: 'dayOfWeek, startTime, endTime, and trainerId are required' },
            { status: 400 }
          );
        }

        // Use auth.clubId if clubId not provided
        const effectiveClubId = clubId || auth.clubId;
        if (!effectiveClubId) {
          return NextResponse.json({ error: 'Club ID required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Find or create a schedule for this club
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id')
          .eq('club_id', effectiveClubId)
          .eq('is_active', true)
          .limit(1);

        let scheduleId: string;
        if (!schedules || schedules.length === 0) {
          // Create a default schedule
          const { data: newSchedule, error: scheduleError } = await supabase
            .from('schedules')
            .insert({
              club_id: effectiveClubId,
              season_type: 'summer',
              season_year: new Date().getFullYear(),
              season_start_date: new Date().toISOString(),
              season_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              is_active: true,
            })
            .select('id')
            .single();

          if (scheduleError || !newSchedule) {
            console.error('Failed to create schedule:', scheduleError);
            return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
          }
          scheduleId = newSchedule.id;
        } else {
          scheduleId = schedules[0].id;
        }

        // Create timeslot_start and timeslot_end timestamps
        // Use next occurrence of dayOfWeek from today
        const now = new Date();
        const currentDay = now.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + daysUntilTarget);

        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const timeslotStart = new Date(targetDate);
        timeslotStart.setHours(startHour, startMin, 0, 0);

        const timeslotEnd = new Date(targetDate);
        timeslotEnd.setHours(endHour, endMin, 0, 0);

        // Insert session
        const { data: session, error: insertError } = await supabase
          .from('sessions')
          .insert({
            schedule_id: scheduleId,
            club_id: effectiveClubId,
            trainer_id: trainerId,
            timeslot_start: timeslotStart.toISOString(),
            timeslot_end: timeslotEnd.toISOString(),
            max_participants: maxParticipants || 10,
            notes: notes || '',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create session:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Invalidate schedule cache for this club
        cache.invalidatePattern(CacheKeys.schedule(effectiveClubId));
        cache.invalidatePattern(`session:`);

        return NextResponse.json(session, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating session:', error);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    });
  });
}

// DELETE /api/sessions/[id] - handled in [id]/route.ts, but we can add bulk delete here if needed
