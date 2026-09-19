/**
 * Buchungsregeln (`booking_rules`) — eine Stelle, an der sie durchgesetzt werden.
 *
 * Vorher prüfte nur `max_bookings_per_week` (und in zwei Routen mit verschiedener
 * Wochendefinition, in Serverzeit). Dauer, Vorlauf, Tageslimit, Wochenende, Prime-Time,
 * gleichzeitige Buchungen und Saisonfenster standen in der Tabelle und im Admin-Formular,
 * wurden aber nirgends geprüft. Alle Zeiten hier sind Berliner Wandzeit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { berlinDateTime, berlinParts } from '@/lib/berlin-time';

export interface BookingRules {
  max_booking_duration_minutes: number | null;
  min_booking_duration_minutes: number | null;
  advance_booking_days: number | null;
  min_advance_booking_hours: number | null;
  max_bookings_per_day: number | null;
  max_bookings_per_week: number | null;
  max_concurrent_bookings: number | null;
  allow_weekend_booking: boolean | null;
  weekend_advance_days: number | null;
  allow_prime_time_booking: boolean | null;
  prime_time_start: string | null;
  prime_time_end: string | null;
  require_approval: boolean | null;
  require_payment: boolean | null;
  season_start_date: string | null;
  season_end_date: string | null;
}

export interface BookingUsage {
  day: { used: number; max: number | null };
  week: { used: number; max: number | null };
  concurrent: { used: number; max: number | null };
}

export type RuleCheck =
  | { ok: true; requiresApproval: boolean; requiresPayment: boolean; usage: BookingUsage }
  | { ok: false; error: string; usage?: BookingUsage };

const RULE_COLUMNS =
  'max_booking_duration_minutes, min_booking_duration_minutes, advance_booking_days, ' +
  'min_advance_booking_hours, max_bookings_per_day, max_bookings_per_week, ' +
  'max_concurrent_bookings, allow_weekend_booking, weekend_advance_days, ' +
  'allow_prime_time_booking, prime_time_start, prime_time_end, require_approval, ' +
  'require_payment, season_start_date, season_end_date';

/** Aktive Mitglieder-Regel des Vereins (höchste Priorität), oder null. */
export async function loadBookingRules(
  db: SupabaseClient,
  clubId: string
): Promise<BookingRules | null> {
  const { data } = await db
    .from('booking_rules')
    .select(RULE_COLUMNS)
    .eq('club_id', clubId)
    .eq('applies_to_role', 'member')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as BookingRules | null) ?? null;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

async function countBookings(
  db: SupabaseClient,
  clubId: string,
  memberId: string,
  from: Date,
  to: Date | null
): Promise<number> {
  let q = db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('member_id', memberId)
    .in('status', ['confirmed', 'pending'])
    .gte('session_start_time', from.toISOString());
  if (to) q = q.lt('session_start_time', to.toISOString());
  const { count } = await q;
  return count ?? 0;
}

/** Aktuelle Auslastung des Mitglieds um `start` herum (Tag, Woche Mo–So, offene Zukunft). */
export async function getBookingUsage(
  db: SupabaseClient,
  rules: BookingRules | null,
  args: { clubId: string; memberId: string; start: Date; now?: Date }
): Promise<BookingUsage> {
  const { date, dayOfWeek } = berlinParts(args.start);
  const monday = addDays(date, -((dayOfWeek + 6) % 7));
  const [day, week, concurrent] = await Promise.all([
    countBookings(
      db,
      args.clubId,
      args.memberId,
      berlinDateTime(date, '00:00'),
      berlinDateTime(addDays(date, 1), '00:00')
    ),
    countBookings(
      db,
      args.clubId,
      args.memberId,
      berlinDateTime(monday, '00:00'),
      berlinDateTime(addDays(monday, 7), '00:00')
    ),
    countBookings(db, args.clubId, args.memberId, args.now ?? new Date(), null),
  ]);
  return {
    day: { used: day, max: rules?.max_bookings_per_day ?? null },
    week: { used: week, max: rules?.max_bookings_per_week ?? null },
    concurrent: { used: concurrent, max: rules?.max_concurrent_bookings ?? null },
  };
}

/**
 * Prüft eine Buchung gegen die Regeln des Vereins.
 * `kind: 'session'` (bestehende Trainingsstunde) prüft nur die Mengenlimits; Dauer, Vorlauf,
 * Wochenende und Prime-Time gelten für frei gewählte Platzzeiten (`'court'`).
 */
export async function checkBookingRules(args: {
  db: SupabaseClient;
  rules: BookingRules | null;
  clubId: string;
  memberId: string;
  start: Date;
  end: Date;
  kind: 'court' | 'session';
  now?: Date;
}): Promise<RuleCheck> {
  const { db, rules, clubId, memberId, start, end, kind } = args;
  const now = args.now ?? new Date();
  const usage = await getBookingUsage(db, rules, { clubId, memberId, start, now });
  const requiresApproval = rules?.require_approval === true;
  const requiresPayment = rules?.require_payment === true;
  const fail = (error: string): RuleCheck => ({ ok: false, error, usage });

  if (start.getTime() <= now.getTime()) return fail('Dieser Zeitpunkt liegt in der Vergangenheit');

  if (rules) {
    const { date, time, dayOfWeek } = berlinParts(start);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (kind === 'court') {
      const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      const { max_booking_duration_minutes: maxD, min_booking_duration_minutes: minD } = rules;
      if (maxD && minutes > maxD) return fail(`Maximale Buchungsdauer: ${maxD} Minuten`);
      if (minD && minutes < minD) return fail(`Mindestbuchungsdauer: ${minD} Minuten`);

      const minLeadH = rules.min_advance_booking_hours;
      if (minLeadH && start.getTime() < now.getTime() + minLeadH * 3_600_000) {
        return fail(`Buchungen sind frühestens ${minLeadH} Std. im Voraus möglich`);
      }

      const horizon =
        isWeekend && rules.weekend_advance_days != null
          ? rules.weekend_advance_days
          : rules.advance_booking_days;
      if (horizon != null && start.getTime() > now.getTime() + horizon * 86_400_000) {
        return fail(`Buchungen sind höchstens ${horizon} Tage im Voraus möglich`);
      }

      if (isWeekend && rules.allow_weekend_booking === false) {
        return fail('Am Wochenende sind keine Buchungen möglich');
      }

      if (rules.allow_prime_time_booking === false && rules.prime_time_start) {
        const ps = toMinutes(rules.prime_time_start);
        const pe = toMinutes(rules.prime_time_end ?? '23:59');
        const s = toMinutes(time);
        const e = s + Math.round((end.getTime() - start.getTime()) / 60_000);
        if (s < pe && e > ps) {
          return fail(
            `Zur Prime-Time (${rules.prime_time_start.slice(0, 5)}–${(rules.prime_time_end ?? '').slice(0, 5)}) sind keine Buchungen möglich`
          );
        }
      }
    }

    if (rules.season_start_date && date < rules.season_start_date) {
      return fail('Vor Saisonbeginn sind noch keine Buchungen möglich');
    }
    if (rules.season_end_date && date > rules.season_end_date) {
      return fail('Nach Saisonende sind keine Buchungen mehr möglich');
    }

    if (usage.day.max && usage.day.used >= usage.day.max) {
      return fail(`Maximal ${usage.day.max} Buchungen pro Tag erreicht`);
    }
    if (usage.week.max && usage.week.used >= usage.week.max) {
      return fail(`Maximal ${usage.week.max} Buchungen pro Woche erreicht`);
    }
    if (usage.concurrent.max && usage.concurrent.used >= usage.concurrent.max) {
      return fail(`Maximal ${usage.concurrent.max} offene Buchungen gleichzeitig erreicht`);
    }
  }

  return { ok: true, requiresApproval, requiresPayment, usage };
}
