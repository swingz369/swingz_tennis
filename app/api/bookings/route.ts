/**
 * POST /api/bookings — Buchung erstellen
 * GET  /api/bookings — Eigene Buchungen abrufen
 *
 * Rewritten to use Supabase client directly (was Drizzle ORM).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { errorResponse, internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createBookingSafe } from '@/lib/booking/safe-booking';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { resolveEffectiveMemberId } from '@/lib/family/family-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { DrizzlePricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import { ClubId, CourtId } from '@/domain/value-objects';
import { createLogger } from '@/lib/logger';
import {
  CreateBookingSchema,
  validateRequestBody,
  formatValidationErrors,
} from '@/lib/validation-schemas';

const log = createLogger('api:bookings');
const pricingRepo = new DrizzlePricingRuleRepository();

// POST /api/bookings
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const validation = validateRequestBody(CreateBookingSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Ungültige Eingabe', details: formatValidationErrors(validation.errors) },
        { status: 400 }
      );
    }
    const { sessionId, memberId, clubId } = validation.data;

    // memberId darf nur der eigene User sein — oder ein minderjähriges Kind
    // derselben Familiengruppe (Eltern buchen für ihre Kinder). Vorher wurde
    // jede fremde memberId ungeprüft übernommen (IDOR).
    const resolution = await resolveEffectiveMemberId(auth.user.id, memberId);
    if (resolution.error) {
      return NextResponse.json({ error: resolution.error }, { status: 403 });
    }
    const userId = resolution.effectiveMemberId;
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

    // Geschlossene Tage aus den Vereins-Öffnungszeiten sperren.
    const { data: clubHours } = await supabase
      .from('clubs')
      .select('opening_hours')
      .eq('id', clubId)
      .maybeSingle();

    if (isDayClosed(clubHours?.opening_hours, new Date(session.timeslot_start))) {
      return NextResponse.json({ error: CLOSED_DAY_ERROR }, { status: 409 });
    }

    // Check booking_rules — how many bookings this week + payment required?
    const { data: rules } = await supabase
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
      if (isConflict) return errorResponse('CONFLICT', result.error ?? 'Konflikt bei der Buchung');
      return internalErrorResponse();
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

    // Gamification: 10 Punkte für erfolgreiche Buchung (fire-and-forget)
    void (async () => {
      try {
        const svc = createServiceClient();
        const { data: existing } = await svc
          .from('gamification_points')
          .select('points')
          .eq('user_id', userId)
          .maybeSingle();
        const current = existing?.points ?? 0;
        await svc
          .from('gamification_points')
          .upsert({ user_id: userId, points: current + 10 }, { onConflict: 'user_id' });
      } catch {
        // Gamification-Fehler blockieren niemals die Buchung
      }
    })();

    // Preisermittlung: Basis = Preis des Platztyps (0 = kostenlos, z. B. Sommer).
    // Darüber werden aktive pricing_rules IMMER angewendet (z. B. Winter-Zuschlag).
    // Der frühere Vereins-Stundenpreis (clubs.default_hourly_rate) wird nicht mehr gelesen.
    let priceInfo: { pricePerHour: number; effectivePricePerHour: number; source: string } | null =
      null;
    try {
      const sessionStart = new Date(session.timeslot_start);
      const sessionEnd = new Date(session.timeslot_end);
      const bookingHours = (sessionEnd.getTime() - sessionStart.getTime()) / 3_600_000;

      let basePricePerHour = 0;
      if (session.court_id) {
        const { data: court } = await supabase
          .from('courts')
          .select('court_type_id')
          .eq('id', session.court_id)
          .maybeSingle();
        if (court?.court_type_id) {
          const { data: courtType } = await supabase
            .from('court_types')
            .select('hourly_rate')
            .eq('id', court.court_type_id)
            .maybeSingle();
          basePricePerHour = Number(courtType?.hourly_rate ?? 0);
        }
      }

      const result = await pricingRepo.calculatePrice(ClubId.fromString(clubId), {
        courtId: session.court_id ? CourtId.fromString(session.court_id) : undefined,
        startTime: sessionStart,
        dayOfWeek: sessionStart.getDay(),
        bookingHours,
        basePricePerHour,
      });
      priceInfo = {
        pricePerHour: result.pricePerHour,
        effectivePricePerHour: +(result.pricePerHour * result.multiplier).toFixed(2),
        source: result.source,
      };
    } catch {
      // Non-blocking: price calculation failure should not prevent booking
      log.warn('[Bookings] Price calculation failed (non-blocking)');
    }

    return NextResponse.json(
      {
        bookingId: result.bookingId,
        sessionId,
        memberId: userId,
        status: 'confirmed',
        payment_status: requiresPayment ? 'pending' : null,
        requiresPayment,
        pricing: priceInfo,
      },
      { status: 201 }
    );
  });
}

// GET /api/bookings?clubId=xxx — Eigene Buchungen
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

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
      return internalErrorResponse();
    }

    return NextResponse.json({ bookings: bookings ?? [] });
  });
}
