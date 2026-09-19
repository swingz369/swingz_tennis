import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkBookingRules, type BookingRules } from '@/lib/booking/booking-rules';
import { berlinDateTime } from '@/lib/berlin-time';

/** Jede Zählabfrage liefert `count` — Tag/Woche/offen sind hier nicht zu unterscheiden. */
function dbWithCount(count: number): SupabaseClient {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'lt']) chain[m] = () => chain;
  chain.then = (resolve: (v: { count: number }) => void) => resolve({ count });
  return { from: () => chain } as unknown as SupabaseClient;
}

const base: BookingRules = {
  max_booking_duration_minutes: 90,
  min_booking_duration_minutes: 30,
  advance_booking_days: 14,
  min_advance_booking_hours: 1,
  max_bookings_per_day: 2,
  max_bookings_per_week: 5,
  max_concurrent_bookings: 3,
  allow_weekend_booking: true,
  weekend_advance_days: 7,
  allow_prime_time_booking: true,
  prime_time_start: '17:00:00',
  prime_time_end: '21:00:00',
  require_approval: false,
  require_payment: false,
  season_start_date: null,
  season_end_date: null,
};

// Fester "jetzt": Mittwoch 2026-09-16 08:00 Berlin
const now = berlinDateTime('2026-09-16', '08:00');
const run = (over: Partial<BookingRules>, date: string, from: string, to: string, count = 0) =>
  checkBookingRules({
    db: dbWithCount(count),
    rules: { ...base, ...over },
    clubId: 'c',
    memberId: 'm',
    start: berlinDateTime(date, from),
    end: berlinDateTime(date, to),
    kind: 'court',
    now,
  });

describe('checkBookingRules', () => {
  it('lässt eine reguläre Buchung durch', async () => {
    expect((await run({}, '2026-09-17', '10:00', '11:00')).ok).toBe(true);
  });

  it.each([
    ['Vergangenheit', {}, '2026-09-15', '10:00', '11:00', 'Vergangenheit'],
    ['zu lang', {}, '2026-09-17', '10:00', '12:00', 'Maximale Buchungsdauer'],
    ['zu kurz', {}, '2026-09-17', '10:00', '10:15', 'Mindestbuchungsdauer'],
    ['zu kurzfristig', {}, '2026-09-16', '08:30', '09:30', 'im Voraus'],
    ['zu weit voraus', {}, '2026-10-20', '10:00', '11:00', 'Tage im Voraus'],
    [
      'Wochenende gesperrt',
      { allow_weekend_booking: false },
      '2026-09-19',
      '10:00',
      '11:00',
      'Wochenende',
    ],
    [
      'Prime-Time gesperrt',
      { allow_prime_time_booking: false },
      '2026-09-17',
      '16:30',
      '17:30',
      'Prime-Time',
    ],
    [
      'vor Saisonbeginn',
      { season_start_date: '2026-10-01' },
      '2026-09-17',
      '10:00',
      '11:00',
      'Saisonbeginn',
    ],
    [
      'nach Saisonende',
      { season_end_date: '2026-09-01' },
      '2026-09-17',
      '10:00',
      '11:00',
      'Saisonende',
    ],
  ])('lehnt ab: %s', async (_n, over, date, from, to, msg) => {
    const r = await run(over as Partial<BookingRules>, date, from, to);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it('Wochenende: weekend_advance_days ersetzt das normale Vorlauffenster', async () => {
    // 10 Tage voraus: unter der Woche erlaubt (14), am Wochenende nicht (7)
    expect((await run({}, '2026-09-24', '10:00', '11:00')).ok).toBe(true);
    expect((await run({}, '2026-09-26', '10:00', '11:00')).ok).toBe(false);
  });

  it('Mengenlimits greifen, sobald der Verbrauch das Maximum erreicht', async () => {
    const r = await run({ max_bookings_per_day: 2 }, '2026-09-17', '10:00', '11:00', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('pro Tag');
  });

  it('kind "session" ignoriert Dauer-/Prime-Time-Regeln, nicht die Mengenlimits', async () => {
    const args = {
      db: dbWithCount(0),
      rules: { ...base, max_booking_duration_minutes: 30, allow_prime_time_booking: false },
      clubId: 'c',
      memberId: 'm',
      start: berlinDateTime('2026-09-17', '17:00'),
      end: berlinDateTime('2026-09-17', '19:00'),
      kind: 'session' as const,
      now,
    };
    expect((await checkBookingRules(args)).ok).toBe(true);
    expect((await checkBookingRules({ ...args, db: dbWithCount(9) })).ok).toBe(false);
  });

  it('meldet require_approval weiter', async () => {
    const r = await run({ require_approval: true }, '2026-09-17', '10:00', '11:00');
    expect(r.ok && r.requiresApproval).toBe(true);
  });
});
