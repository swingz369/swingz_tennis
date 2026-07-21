/**
 * GET /api/sessions?clubId=xxx
 *
 * Returns sessions for a club — rewritten to use Supabase client directly
 * instead of Drizzle ORM (which requires DATABASE_URL and bypasses RLS).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions');

// Row type aliases from generated Supabase types
type SessionRow = Database['public']['Tables']['sessions']['Row'];
type TrainerRow = Database['public']['Tables']['trainers']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SessionRsvpRow = Database['public']['Tables']['session_rsvps']['Row'];
type CourtJoin = { name: string | null };
type SessionWithJoins = SessionRow & {
  schedules: { club_id: string } | { club_id: string }[] | null;
  courts: CourtJoin | CourtJoin[] | null;
};

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubIdParam = url.searchParams.get('clubId');
    if (!clubIdParam) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const supabase = auth.supabase as SupabaseClient<Database>;
    const userId = auth.user.id;

    try {
      // Fetch upcoming sessions for this club (via schedule)
      const dateFromParam = url.searchParams.get('dateFrom');
      const dateToParam = url.searchParams.get('dateTo');
      const now = new Date().toISOString();
      const fourWeeksLater = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      const rangeFrom = dateFromParam ?? now;
      const rangeTo = dateToParam ?? fourWeeksLater;

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(
          `
          id,
          timeslot_start,
          timeslot_end,
          max_participants,
          trainer_id,
          court_id,
          week_number,
          session_type,
          notes,
          cancelled_at,
          cancellation_reason,
          plan_entry_id,
          schedules!inner(club_id),
          courts(name)
        `
        )
        .eq('schedules.club_id', clubIdParam)
        .gte('timeslot_start', rangeFrom)
        .lte('timeslot_start', rangeTo)
        .order('timeslot_start', { ascending: true });

      if (sessionsError) {
        log.error('[Sessions API]', sessionsError);
        return NextResponse.json({ error: sessionsError.message }, { status: 500 });
      }

      const typedSessions = (sessions ?? []) as unknown as SessionWithJoins[];

      // Fetch trainer names
      const trainerIds = [
        ...new Set(
          typedSessions.map((s) => s.trainer_id).filter((id): id is string => Boolean(id))
        ),
      ];
      const trainersMap = new Map<string, string>();

      if (trainerIds.length > 0) {
        const { data: trainerData } = await supabase
          .from('trainers')
          .select('id, name, email')
          .in('id', trainerIds);

        ((trainerData ?? []) as Pick<TrainerRow, 'id' | 'name' | 'email'>[]).forEach((t) => {
          trainersMap.set(t.id, t.name || t.email || 'Trainer');
        });

        // Also check users table for trainer names
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', trainerIds);

        ((usersData ?? []) as Pick<UserRow, 'id' | 'full_name'>[]).forEach((u) => {
          if (u.full_name && !trainersMap.has(u.id)) {
            trainersMap.set(u.id, u.full_name);
          }
        });
      }

      // Fetch ALL active bookings for this club's upcoming sessions (with member names)
      const sessionIds = typedSessions.map((s) => s.id);
      const activeStatuses: BookingRow['status'][] = ['pending', 'confirmed'];

      const { data: allActiveBookings } =
        sessionIds.length > 0
          ? await supabase
              .from('bookings')
              .select('id, session_id, status, member_id, users!bookings_member_id_fkey(full_name)')
              .in('session_id', sessionIds)
              .in('status', activeStatuses)
              .eq('club_id', clubIdParam)
          : { data: [] as unknown[] };

      const typedBookings = (allActiveBookings ?? []) as Array<{
        id: string;
        session_id: string;
        status: string;
        member_id: string;
        users: { full_name: string | null } | { full_name: string | null }[] | null;
      }>;

      // Build per-session booking stats + member names
      const sessionBookingCount = new Map<string, number>();
      const sessionBookerNames = new Map<string, string[]>();
      typedBookings.forEach((b) => {
        sessionBookingCount.set(b.session_id, (sessionBookingCount.get(b.session_id) ?? 0) + 1);
        const user = Array.isArray(b.users) ? b.users[0] : b.users;
        const name = user?.full_name || 'Mitglied';
        const names = sessionBookerNames.get(b.session_id) ?? [];
        names.push(name);
        sessionBookerNames.set(b.session_id, names);
      });

      // Build current-user booking map
      const bookingsMap = new Map<string, { bookingId: string; status: string }>();
      typedBookings
        .filter((b) => b.member_id === userId)
        .forEach((b) => {
          bookingsMap.set(b.session_id, { bookingId: b.id, status: b.status });
        });

      // Fetch current-user RSVPs for these sessions (separate from bookings)
      const rsvpMap = new Map<string, string>();
      if (sessionIds.length > 0) {
        const { data: rsvps, error: rsvpError } = await supabase
          .from('session_rsvps')
          .select('session_id, status, member_id')
          .eq('member_id', userId)
          .in('session_id', sessionIds);

        if (rsvpError) {
          // Non-fatal: log and continue without RSVP data
          log.warn('[Sessions API] RSVP fetch failed:', rsvpError.message);
        } else {
          ((rsvps ?? []) as Pick<SessionRsvpRow, 'session_id' | 'status' | 'member_id'>[]).forEach(
            (r) => {
              rsvpMap.set(r.session_id, r.status);
            }
          );
        }
      }

      // Transform sessions to the format the booking UI expects
      const result = typedSessions.map((s) => {
        const start = new Date(s.timeslot_start);
        const end = new Date(s.timeslot_end);
        // dayOfWeek: JS convention 0=Sun, 1=Mon, ..., 6=Sat → API uses 1-7
        const jsDay = start.getDay();
        const dayOfWeek = jsDay === 0 ? 7 : jsDay;

        const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
        const booking = bookingsMap.get(s.id);
        const currentBookings = sessionBookingCount.get(s.id) ?? 0;
        const maxParticipants = s.max_participants ?? 4;
        const bookerNames = sessionBookerNames.get(s.id) ?? [];

        return {
          id: s.id,
          dayOfWeek,
          startTime: start.toTimeString().substring(0, 5),
          endTime: end.toTimeString().substring(0, 5),
          timeslotStart: s.timeslot_start,
          timeslotEnd: s.timeslot_end,
          trainerId: s.trainer_id,
          trainerName: trainersMap.get(s.trainer_id ?? '') ?? 'Trainer',
          courtName: court?.name ?? 'Platz',
          maxParticipants,
          sessionType: s.session_type ?? 'training',
          notes: s.notes ?? null,
          courtId: s.court_id,
          bookedByUser: !!booking,
          bookingId: booking?.bookingId ?? null,
          bookingStatus: booking?.status ?? null,
          rsvpStatus: rsvpMap.get(s.id) ?? null,
          hasActiveBooking: currentBookings > 0,
          currentBookings,
          bookerNames,
          cancelledAt: (s as any).cancelled_at ?? null,
          cancellationReason: (s as any).cancellation_reason ?? null,
          planEntryId: (s as any).plan_entry_id ?? null,
        };
      });

      return NextResponse.json(result);
    } catch (err) {
      log.error('[Sessions API] Unexpected error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

/**
 * POST /api/sessions — Create session (admin/trainer only)
 */
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const {
      schedule_id,
      trainer_id,
      court_id,
      timeslot_start,
      timeslot_end,
      max_participants,
      group_ids,
      week_number,
    } = body as {
      schedule_id?: string;
      trainer_id?: string | null;
      court_id?: string | null;
      timeslot_start?: string;
      timeslot_end?: string;
      max_participants?: number;
      group_ids?: string[];
      week_number?: number;
    };

    if (!schedule_id || !timeslot_start || !timeslot_end) {
      return NextResponse.json(
        { error: 'schedule_id, timeslot_start, timeslot_end required' },
        { status: 400 }
      );
    }

    const supabase = auth.supabase as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        schedule_id,
        trainer_id: trainer_id || null,
        court_id: court_id || null,
        timeslot_start,
        timeslot_end,
        max_participants: max_participants ?? 4,
        group_ids: group_ids ?? [],
        week_number: week_number ?? 1,
      })
      .select()
      .single();

    if (error) {
      log.error('[Sessions POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  });
}
