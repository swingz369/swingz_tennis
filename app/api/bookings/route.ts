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

    // Check if already booked
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('member_id', userId)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Du hast diese Session bereits gebucht' }, { status: 409 });
    }

    // Check capacity
    const { count: bookedCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .in('status', ['confirmed', 'pending']);

    if ((bookedCount ?? 0) >= (session.max_participants ?? 4)) {
      return NextResponse.json({ error: 'Session ist ausgebucht' }, { status: 409 });
    }

    // Check booking_rules — how many bookings this week?
    const { data: rules } = await supabase
      .from('booking_rules')
      .select('max_bookings_per_week, cancellation_hours_before')
      .eq('club_id', clubId)
      .eq('applies_to_role', 'member')
      .maybeSingle();

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

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        club_id: clubId,
        member_id: userId,
        session_id: sessionId,
        schedule_id: session.schedule_id,
        status: 'confirmed',
        session_start_time: session.timeslot_start,
        start_time: session.timeslot_start,
        end_time: session.timeslot_end,
        booking_type: 'session',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('[Bookings POST]', bookingError);
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    return NextResponse.json(
      { bookingId: booking.id, sessionId, memberId: userId, status: booking.status },
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

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId') ?? auth.clubId;

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
