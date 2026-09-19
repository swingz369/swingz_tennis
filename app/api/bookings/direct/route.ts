/**
 * POST /api/bookings/direct
 *
 * Direct court booking — allows members to book a free court slot
 * without a pre-existing trainer session. Creates an ad-hoc "walk_in"
 * session and a booking in one transaction.
 *
 * Body: { courtId, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), clubId }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { loadBookingRules, checkBookingRules } from '@/lib/booking/booking-rules';
import { resolveEffectiveMemberId } from '@/lib/family/family-auth';
import { berlinDateTime } from '@/lib/berlin-time';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:bookings:direct');

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const { courtId, date, startTime, endTime, clubId, memberId } = body as {
      courtId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      clubId?: string;
      memberId?: string;
    };

    if (!courtId || !date || !startTime || !endTime || !clubId) {
      return NextResponse.json(
        { error: 'courtId, date, startTime, endTime und clubId sind erforderlich' },
        { status: 400 }
      );
    }

    // Der Verein kommt aus dem Body: ohne diese Prüfung buchte ein Mitglied von Verein A
    // (Service-Client unten) Plätze in Verein B.
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    // memberId darf nur der eigene User sein — oder ein minderjähriges Kind
    // derselben Familiengruppe (Eltern buchen für ihre Kinder).
    const resolution = await resolveEffectiveMemberId(auth.user.id, memberId);
    if (resolution.error) {
      return NextResponse.json({ error: resolution.error }, { status: 403 });
    }
    const effectiveMemberId = resolution.effectiveMemberId;

    // Build timestamps
    const timeslotStart = berlinDateTime(date, startTime);
    const timeslotEnd = berlinDateTime(date, endTime);

    if (isNaN(timeslotStart.getTime()) || isNaN(timeslotEnd.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Datums-/Zeitformat' }, { status: 400 });
    }

    if (timeslotEnd <= timeslotStart) {
      return NextResponse.json({ error: 'endTime muss nach startTime liegen' }, { status: 400 });
    }

    // Use service client for ad-hoc session creation (bypasses RLS on sessions)
    // Auth and role checks are already done above.
    const serviceClient = createServiceClient();

    // Geschlossene Tage aus den Vereins-Öffnungszeiten sperren.
    const { data: clubHours } = await serviceClient
      .from('clubs')
      .select('opening_hours')
      .eq('id', clubId)
      .maybeSingle();

    if (isDayClosed(clubHours?.opening_hours, timeslotStart)) {
      return NextResponse.json({ error: CLOSED_DAY_ERROR }, { status: 409 });
    }

    // 1. Find the club's active schedule
    const { data: schedule, error: scheduleError } = await serviceClient
      .from('schedules')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Kein aktiver Stundenplan gefunden. Bitte zuerst eine Saison erstellen.' },
        { status: 404 }
      );
    }

    // Der Platz muss zu diesem Verein gehören.
    const { data: court } = await serviceClient
      .from('courts')
      .select('id')
      .eq('id', courtId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!court) {
      return NextResponse.json({ error: 'Platz nicht gefunden' }, { status: 404 });
    }

    // 2. Buchungsregeln des Vereins (Dauer, Vorlauf, Tages-/Wochenlimit, Prime-Time, …)
    const rules = await loadBookingRules(serviceClient, clubId);
    const check = await checkBookingRules({
      db: serviceClient,
      rules,
      clubId,
      memberId: effectiveMemberId,
      start: timeslotStart,
      end: timeslotEnd,
      kind: 'court',
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 409 });
    }
    const { requiresPayment, requiresApproval } = check;

    // 3. Calculate week number (ISO week)
    // Overlap is enforced by the sessions_no_overlap exclusion constraint in the DB
    const d = new Date(timeslotStart);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const weekNumber =
      Math.round((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7) + 1;

    // 4. Create ad-hoc walk_in session
    const { data: session, error: sessionError } = await serviceClient
      .from('sessions')
      .insert({
        schedule_id: schedule.id,
        trainer_id: null, // walk-in has no trainer
        group_ids: [],
        week_number: weekNumber,
        timeslot_start: timeslotStart.toISOString(),
        timeslot_end: timeslotEnd.toISOString(),
        court_id: courtId,
        max_participants: 1,
        session_type: 'walk_in',
        notes: `Direktbuchung von ${auth.user.email ?? auth.user.id}`,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      log.error('[Bookings Direct] Failed to create walk-in session:', sessionError);
      // Exclusion constraint violation = overlapping session
      if (sessionError?.code === '23P01' || sessionError?.message?.includes('exclusion')) {
        return NextResponse.json(
          { error: 'Dieser Platz ist in diesem Zeitraum bereits belegt' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Session konnte nicht erstellt werden' }, { status: 500 });
    }

    // 5. Create the booking directly (skip createBookingSafe since we just created the session)
    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .insert({
        club_id: clubId,
        member_id: effectiveMemberId,
        schedule_id: schedule.id,
        session_id: session.id,
        court_id: courtId,
        session_start_time: timeslotStart.toISOString(),
        start_time: timeslotStart.toISOString(),
        end_time: timeslotEnd.toISOString(),
        booking_type: 'court',
        status: requiresApproval ? 'pending' : 'confirmed',
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (bookingError || !booking) {
      // Rollback: delete the session if booking fails
      await serviceClient.from('sessions').delete().eq('id', session.id);
      log.error('[Bookings Direct] Failed to create booking:', bookingError);

      if (bookingError?.code === '23505') {
        return NextResponse.json(
          { error: 'Du hast diesen Platz bereits gebucht' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Buchung konnte nicht erstellt werden' }, { status: 500 });
    }

    return NextResponse.json(
      {
        bookingId: booking.id,
        sessionId: session.id,
        memberId: effectiveMemberId,
        status: requiresApproval ? 'pending' : 'confirmed',
        payment_status: requiresPayment ? 'pending' : null,
        requiresPayment,
      },
      { status: 201 }
    );
  });
}
