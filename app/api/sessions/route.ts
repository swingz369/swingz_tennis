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

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubIdParam = url.searchParams.get('clubId');
    if (!clubIdParam) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const supabase = auth.supabase;
    const userId = auth.user.id;

    try {
      // Fetch upcoming sessions for this club (via schedule)
      const now = new Date().toISOString();
      const fourWeeksLater = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

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
          schedules!inner(club_id),
          courts(name)
        `
        )
        .eq('schedules.club_id', clubIdParam)
        .gte('timeslot_start', now)
        .lte('timeslot_start', fourWeeksLater)
        .order('timeslot_start', { ascending: true });

      if (sessionsError) {
        console.error('[Sessions API]', sessionsError);
        return NextResponse.json({ error: sessionsError.message }, { status: 500 });
      }

      // Fetch trainer names
      const trainerIds = [
        ...new Set((sessions ?? []).map((s: any) => s.trainer_id).filter(Boolean)),
      ];
      const trainersMap = new Map<string, string>();

      if (trainerIds.length > 0) {
        const { data: trainerData } = await supabase
          .from('trainers')
          .select('id, name, email')
          .in('id', trainerIds);

        (trainerData ?? []).forEach((t: any) => {
          trainersMap.set(t.id, t.name || t.email || 'Trainer');
        });

        // Also check users table for trainer names
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', trainerIds);

        (usersData ?? []).forEach((u: any) => {
          if (u.full_name && !trainersMap.has(u.id)) {
            trainersMap.set(u.id, u.full_name);
          }
        });
      }

      // Fetch current user's bookings for this club
      const { data: userBookings } = await supabase
        .from('bookings')
        .select('id, session_id, status')
        .eq('member_id', userId)
        .eq('club_id', clubIdParam);

      const bookingsMap = new Map<string, { bookingId: string; status: string }>();
      (userBookings ?? []).forEach((b: any) => {
        bookingsMap.set(b.session_id, { bookingId: b.id, status: b.status });
      });

      // Transform sessions to the format the booking UI expects
      const result = (sessions ?? []).map((s: any) => {
        const start = new Date(s.timeslot_start);
        const end = new Date(s.timeslot_end);
        // dayOfWeek: JS convention 0=Sun, 1=Mon, ..., 6=Sat → API uses 1-7
        const jsDay = start.getDay();
        const dayOfWeek = jsDay === 0 ? 7 : jsDay;

        const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
        const booking = bookingsMap.get(s.id);

        return {
          id: s.id,
          dayOfWeek,
          startTime: start.toTimeString().substring(0, 5),
          endTime: end.toTimeString().substring(0, 5),
          timeslotStart: s.timeslot_start,
          timeslotEnd: s.timeslot_end,
          trainerId: s.trainer_id,
          trainerName: trainersMap.get(s.trainer_id) ?? 'Trainer',
          courtName: court?.name ?? 'Platz',
          maxParticipants: s.max_participants ?? 4,
          week: s.week_number?.toString() ?? '1',
          bookedByUser: !!booking,
          bookingId: booking?.bookingId ?? null,
          bookingStatus: booking?.status ?? null,
        };
      });

      return NextResponse.json(result);
    } catch (err) {
      console.error('[Sessions API] Unexpected error:', err);
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
    } = body;

    if (!schedule_id || !timeslot_start || !timeslot_end) {
      return NextResponse.json(
        { error: 'schedule_id, timeslot_start, timeslot_end required' },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
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
      console.error('[Sessions POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  });
}
