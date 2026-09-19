import { describe, it, expect } from 'vitest';
import { buildPublishPlan } from '@/lib/season-planning/publish-plan';

const CLUB = 'c0000000-0000-4000-8000-000000000001';
const TRAINER = 't0000000-0000-4000-8000-000000000001';
const SUB = 't0000000-0000-4000-8000-000000000002';
const COURT = 'p0000000-0000-4000-8000-000000000001';
const GROUP = 'g0000000-0000-4000-8000-000000000001';

// Saison Mo 07.09.2026 – So 27.09.2026 = 3 volle Wochen
const season = {
  id: 's1',
  club_id: CLUB,
  year: 2026,
  season_type: 'summer',
  start_date: '2026-09-07',
  end_date: '2026-09-27',
  published_at: null,
} as never;

function entry(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    trainer_id: TRAINER,
    court_id: COURT,
    group_id: GROUP,
    day_of_week: 0, // Montag
    start_time: '17:00:00',
    end_time: '18:30:00',
    duration_minutes: 90,
    starts_from_week: 1,
    ends_at_week: null,
    max_participants: 8,
    expected_participants: ['m1', 'm2'],
    sessions_per_week: 1,
    day_of_week_2: null,
    substitute_trainer_id: null,
    substitute_from_week: null,
    substitute_to_week: null,
    ...over,
  } as never;
}

const base = {
  season,
  holidays: [],
  inactiveWeeks: new Set<string>(),
  isRepublish: false,
  now: new Date('2026-09-01T00:00:00Z'),
};

describe('buildPublishPlan', () => {
  it('legt je Woche eine Session und je Teilnehmer eine Buchung an', () => {
    const plan = buildPublishPlan({ ...base, entries: [entry()] });
    expect(plan.sessions).toHaveLength(3);
    expect(plan.bookings).toHaveLength(6);
    expect(plan.entryUpdates).toEqual([{ id: 'e1', sid: plan.sessions[0].id }]);
    expect(plan.schedule).toMatchObject({ season_type: 'summer', season_year: 2026 });
  });

  it('legt ohne Platz keine Buchungen an', () => {
    const plan = buildPublishPlan({ ...base, entries: [entry({ court_id: null })] });
    expect(plan.sessions).toHaveLength(3);
    expect(plan.bookings).toHaveLength(0);
  });

  it('bezieht Termine am Enddatum der Saison ein', () => {
    // Saison endet Sonntag 27.09.; ein Sonntagstermin (Turnier) in Woche 3 muss bleiben
    const plan = buildPublishPlan({ ...base, entries: [entry({ day_of_week: 6 })] });
    expect(plan.sessions).toHaveLength(3);
  });

  it('lässt Ferienwochen und inaktive Gruppenwochen aus', () => {
    const holidays = [{ start: '2026-09-14', end: '2026-09-14' }] as never;
    const plan = buildPublishPlan({
      ...base,
      holidays,
      inactiveWeeks: new Set([`${GROUP}|3`]),
      entries: [entry()],
    });
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0].week_number).toBe(1);
  });

  it('setzt den Vertretungstrainer nur im Vertretungszeitraum ein', () => {
    const plan = buildPublishPlan({
      ...base,
      entries: [
        entry({ substitute_trainer_id: SUB, substitute_from_week: 2, substitute_to_week: 2 }),
      ],
    });
    expect(plan.sessions.map((s) => s.trainer_id)).toEqual([TRAINER, SUB, TRAINER]);
  });

  it('erzeugt bei sessions_per_week=2 einen zweiten Wochentermin', () => {
    const plan = buildPublishPlan({
      ...base,
      entries: [entry({ sessions_per_week: 2, day_of_week_2: 3 })],
    });
    expect(plan.sessions).toHaveLength(6);
    expect(plan.sessions.filter((s) => String(s.notes).includes('2. Wochentermin'))).toHaveLength(
      3
    );
  });

  it('übergeht beim erneuten Veröffentlichen vergangene Termine', () => {
    const plan = buildPublishPlan({
      ...base,
      isRepublish: true,
      now: new Date('2026-09-10T00:00:00Z'),
      entries: [entry()],
    });
    // Woche 1 (07.09.) liegt vor "jetzt" (10.09.)
    expect(plan.sessions.map((s) => s.week_number)).toEqual([2, 3]);
  });

  it('hält 17:00 Ortszeit über die Zeitumstellung hinweg', () => {
    const winter = {
      ...(season as object),
      season_type: 'winter',
      start_date: '2026-10-19',
      end_date: '2026-11-08',
    } as never;
    const plan = buildPublishPlan({ ...base, season: winter, entries: [entry()] });
    const hours = plan.sessions.map((s) => new Date(String(s.timeslot_start)).getUTCHours());
    expect(hours).toEqual([15, 16, 16]); // 26.10. ist die Umstellung auf Winterzeit
  });

  it('fällt bei ungültigem Jahr auf das aktuelle Jahr zurück', () => {
    const plan = buildPublishPlan({
      ...base,
      season: { ...(season as object), year: NaN } as never,
      entries: [entry()],
    });
    expect(plan.schedule.season_year).toBe(new Date().getFullYear());
  });
});
