/**
 * POST /api/bookings — Buchung erstellen
 * GET  /api/bookings — Eigene Buchungen abrufen
 *
 * Rewritten to use Supabase client directly (was Drizzle ORM).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createBookingSafe } from '@/lib/booking/safe-booking';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:bookings');

// POST /api/bookings
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { sessionId, memberId, clubId } = body;
    if (!sessionId || !clubId) {
      return NextResponse.json({ error: 'sessionId and clubId required' }, { status: 400 });
    }

    const userId = memberId || auth.user.id;
    const supabase = auth.supabase;

    // Check session exists and get details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, timeslot_start, timeslot_end, max_participants, court_id, schedule_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    // Check booking_rules — how many bookings this week + payment required?
    const { data: rules } = await (supabase as any)
      .from('booking_rules')
      .select('max_bookings_per_week, cancellation_hours_before, require_payment')
      .eq('club_id', clubId)
      .eq('applies_to_role', 'member')
      .maybeSingle();

    const requiresPayment = rules?.require_payment === true;

    if (rules?.max_bookings_per_week) {
      const sessionDate = new Date(session.timeslot_start);
      const weekStart = new Date(sessionDate);
      weekStart.setDate(sessionDate.getDate() - sessionDate.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const { count: weekBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('club_id', clubId)
        .in('status', ['confirmed', 'pending'])
        .gte('session_start_time', weekStart.toISOString())
        .lt('session_start_time', weekEnd.toISOString());

      if ((weekBookings ?? 0) >= rules.max_bookings_per_week) {
        return NextResponse.json(
          { error: `Maximum ${rules.max_bookings_per_week} Buchungen pro Woche erreicht` },
          { status: 409 }
        );
      }
    }

    // Atomic booking via DB RPC — prevents race conditions and double-bookings
    const result = await createBookingSafe({
      memberId: userId,
      sessionId,
      clubId,
      scheduleId: session.schedule_id ?? '',
    });

    if (!result.success) {
      const isConflict =
        result.error?.includes('already booked') ||
        result.error?.includes('fully booked') ||
        result.error?.includes('already started');
      return NextResponse.json({ error: result.error }, { status: isConflict ? 409 : 500 });
    }

    // Fire-and-forget: create hours_log entry when the session has a trainer.
    // Failures here must NOT block the booking response.
    if (result.bookingId) {
      (async () => {
        try {
          const { data: sess } = await supabase
            .from('sessions')
            .select('trainer_id, timeslot_start, timeslot_end, users(full_name)')
            .eq('id', sessionId)
            .not('trainer_id', 'is', null)
            .maybeSingle();

          if (sess?.trainer_id) {
            const start = new Date(sess.timeslot_start);
            const end = new Date(sess.timeslot_end);
            const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
            const trainerName =
              (Array.isArray(sess.users) ? sess.users[0] : sess.users)?.full_name ?? 'Trainer';
            await supabase.from('hours_logs').insert({
              trainer_id: sess.trainer_id,
              trainer_name: trainerName,
              session_id: sessionId,
              date: start.toISOString().substring(0, 10),
              start_time: start.toTimeString().substring(0, 8),
              end_time: end.toTimeString().substring(0, 8),
              duration: durationMinutes,
              type: 'training',
              status: 'pending',
              club_id: clubId,
            });
          }
        } catch (err) {
          log.warn('[Bookings] hours_log auto-create failed (non-blocking):', err);
        }
      })();
    }

    return NextResponse.json(
      {
        bookingId: result.bookingId,
        sessionId,
        memberId: userId,
        status: 'confirmed',
        payment_status: requiresPayment ? 'pending' : null,
        requiresPayment,
      },
      { status: 201 }
    );
  });
}

// GET /api/bookings?clubId=xxx — Eigene Buchungen
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { data: bookings, error } = await auth.supabase
      .from('bookings')
      .select(
        `
        id,
        status,
        session_start_time,
        start_time,
        end_time,
        payment_status,
        session_id,
        sessions(timeslot_start, timeslot_end, courts(name))
      `
      )
      .eq('member_id', auth.user.id)
      .order('session_start_time', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: bookings ?? [] });
  });
}
