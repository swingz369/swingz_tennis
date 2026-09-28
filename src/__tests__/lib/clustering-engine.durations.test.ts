/**
 * Unterschiedlich lange Einheiten in der Saisonplanung.
 *
 * - Individuelle Dauer je Spieler (`user_club_memberships.training_minutes`): wer denselben
 *   Wert hat, wird gemeinsam eingeplant, in Slots genau dieser Länge.
 * - Doppelstunden (Team-/Leistungsgruppen) dürfen nur liegen, wo alle die GANZE Zeit können.
 * - Nachträgliche Zuweisungen (zweite Runde) prüfen Niveau, Alter und Dauer auch bei Gruppen,
 *   die erst in diesem Lauf entstanden sind.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';
import type { GroupAssignment } from '@/lib/season-planning/types';

const leer = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};
const ganzerTag = [{ start: '08:00', end: '22:00' }];

const member = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  name: id,
  email: '',
  skillLevel: 'intermediate',
  experienceMonths: 6,
  attendanceQuote: null,
  readyForNextLevel: false,
  recommendedLevel: null,
  promotedLevel: null,
  availability: { ...leer, monday: ganzerTag, tuesday: ganzerTag },
  wishPartnerIds: [],
  avoidMemberIds: [],
  selfAssessedLevel: null,
  previousGroupId: null,
  isMinor: false,
  maxSessionsPerWeek: 1,
  preferredCourtIds: [],
  preferredGroupIds: [],
  priority: 5,
  ...o,
});

const trainer = (id: string) => ({
  id,
  name: id,
  specialties: [],
  maxHoursPerWeek: 30,
  utilizationPct: 100,
  availability: {
    ...leer,
    monday: ganzerTag,
    tuesday: ganzerTag,
    wednesday: ganzerTag,
    thursday: ganzerTag,
  },
  maxSessionsPerWeek: 20,
  preferredCourtIds: [],
  canTeachGroups: [],
  sessionsAssigned: 0,
});

const courts = [
  { id: 'c1', name: 'Platz 1' },
  { id: 'c2', name: 'Platz 2' },
];

/** Standard-Slotliste wie in runClustering (buildStandardTimeSlots, bis 21 Uhr). */
function standardSlots(minutes: number) {
  const f = (x: number) =>
    `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  const slots = [];
  for (let t = 8 * 60; t + minutes <= 21 * 60; t += minutes)
    slots.push({ start: f(t), end: f(t + minutes) });
  return slots;
}

async function plan(
  members: unknown[],
  cfg: Record<string, unknown> = {},
  trainers = [trainer('t1'), trainer('t2')]
) {
  const engine = new SeasonClusteringEngine('s', 'c', { multiStart: false, ...cfg }) as never as {
    config: { slotDurationMinutes: number };
    greedyCluster: (
      ...a: unknown[]
    ) => Promise<{ assignments: GroupAssignment[]; unassigned: { id: string }[] }>;
  };
  return engine.greedyCluster(
    members,
    trainers,
    courts,
    new Map(),
    {},
    standardSlots(engine.config.slotDurationMinutes)
  );
}

const dauer = (g: GroupAssignment) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return m(g.endTime) - m(g.startTime);
};
const gruppeVon = (r: { assignments: GroupAssignment[] }, id: string) =>
  r.assignments.find((g) => g.memberIds.includes(id))!;

describe('individuelle Trainingsdauer', () => {
  it('plant Spieler mit 90 Minuten gemeinsam in einem 90-Minuten-Slot, die übrigen im Standard', async () => {
    const r = await plan([
      member('lang1', { trainingMinutes: 90 }),
      member('lang2', { trainingMinutes: 90 }),
      member('std1'),
      member('std2'),
    ]);

    expect(r.unassigned).toEqual([]);
    const lang = gruppeVon(r, 'lang1');
    expect(lang.memberIds.sort()).toEqual(['lang1', 'lang2']);
    expect(dauer(lang)).toBe(90);
    const std = gruppeVon(r, 'std1');
    expect(std.memberIds.sort()).toEqual(['std1', 'std2']);
    expect(dauer(std)).toBe(60);
  });

  it('gilt auch für Niveaus mit Doppelstunde — die eigene Angabe gewinnt', async () => {
    const r = await plan([member('a', { skillLevel: 'advanced', trainingMinutes: 90 })]);
    expect(dauer(gruppeVon(r, 'a'))).toBe(90);
  });

  it('verplant einen langen Slot nur, wenn das Mitglied die ganze Zeit kann', async () => {
    const r = await plan([
      member('a', {
        trainingMinutes: 120,
        availability: { ...leer, monday: [{ start: '18:00', end: '19:00' }] },
      }),
    ]);
    expect(r.assignments).toEqual([]);
    expect(r.unassigned.map((m) => m.id)).toEqual(['a']);
  });
});

describe('Doppelstunde (Team-/Leistungsgruppe)', () => {
  it('liegt nur, wo alle die ganzen zwei Stunden können (über runClustering)', async () => {
    // Über den vollen Lauf, denn der Fehler steckte im Verfügbarkeits-Cache, den nur
    // runClustering baute: er schlüsselte nach Startzeit und kannte nur 60-Minuten-Slots —
    // eine Doppelstunde 18–20 Uhr galt als passend für jemanden, der 18–19 Uhr kann.
    const repo = {
      planningConfig: async () => null,
      findSeason: async () => null,
      seasonIdsOfType: async () => [],
      clubBundesland: async () => null,
      submittedMemberPrefs: async () => [
        {
          pref: {
            user_id: 'a',
            weekly_availability: { ...leer, monday: [{ start: '18:00', end: '19:00' }] },
          },
          user_name: 'a',
          user_skill_level: 'advanced',
          user_experience: 24,
        },
      ],
      baselineMemberPrefs: async () => [],
      activeMemberships: async () => [{ user_id: 'a', role: 'member', include_in_planning: true }],
      userProfiles: async () => [],
      trainerFeedback: async () => [],
      submittedTrainerPrefs: async () => [],
      activeClubTrainers: async () => [
        { id: 't1', name: 't1', specialties: [], max_hours_per_week: 30 },
      ],
      activeTrainersByMembership: async () => [],
      activeClosures: async () => [],
      trainingCourts: async () => [{ id: 'c1', name: 'Platz 1', surface: 'sand', is_active: true }],
      activeGroups: async () => [],
      seasonStatistics: async () => [],
      planEntries: async () => [],
    };
    const engine = new SeasonClusteringEngine('s', 'c', { multiStart: false }, repo as never);

    const result = await engine.runClustering(true);

    expect(result.groups).toEqual([]);
    expect(result.unassignedMembers.map((m) => m.memberId)).toEqual(['a']);
  });

  it('kann bei 45-Minuten-Takt um 17 Uhr beginnen', async () => {
    const r = await plan(
      [
        member('a', {
          skillLevel: 'advanced',
          availability: { ...leer, monday: [{ start: '17:00', end: '19:00' }] },
        }),
      ],
      { slotDurationMinutes: 45 }
    );
    // Früher fand eine Doppelstunde bei 45-Minuten-Takt nur 08, 14 oder 20 Uhr.
    const g = gruppeVon(r, 'a');
    expect([g.startTime, g.endTime]).toEqual(['17:00', '19:00']);
  });
});

describe('zweite Runde', () => {
  const nur17 = { ...leer, monday: [{ start: '17:00', end: '18:00' }] };

  it('setzt kein Kind in eine Erwachsenengruppe', async () => {
    const r = await plan([
      member('e1', { availability: nur17 }),
      member('e2', { availability: nur17 }),
      // k1 meidet k2 und fällt deshalb in die zweite Runde.
      member('k1', { isMinor: true, availability: nur17, avoidMemberIds: ['k2'] }),
      member('k2', { isMinor: true, availability: nur17 }),
    ]);
    for (const g of r.assignments) {
      const kind = g.memberIds.some((id) => id.startsWith('k'));
      const erwachsen = g.memberIds.some((id) => id.startsWith('e'));
      expect(kind && erwachsen).toBe(false);
    }
  });

  it('hält die Niveau-Spanne auch bei neu entstandenen Gruppen ein', async () => {
    const r = await plan(
      [
        member('m1', { availability: nur17 }),
        member('m2', { availability: nur17 }),
        member('profi', { skillLevel: 'professional', availability: nur17 }),
      ],
      {},
      [trainer('t1')]
    );
    const profi = r.assignments.find((g) => g.memberIds.includes('profi'));
    expect(profi?.memberIds.includes('m1') ?? false).toBe(false);
  });

  it('mischt keine Dauern', () => {
    const engine = new SeasonClusteringEngine('s', 'c', {}) as never as {
      fitsAssignment: (m: unknown, a: unknown, byId: Map<string, unknown>) => boolean;
    };
    const einheit = (endTime: string) => ({
      groupId: 'x',
      memberIds: [],
      dayOfWeek: 0,
      startTime: '17:00',
      endTime,
    });
    const std = member('std', { availability: { ...leer, monday: ganzerTag } });
    const lang = member('lang', {
      trainingMinutes: 90,
      availability: { ...leer, monday: ganzerTag },
    });

    expect(engine.fitsAssignment(std, einheit('18:00'), new Map())).toBe(true);
    expect(engine.fitsAssignment(std, einheit('18:30'), new Map())).toBe(false);
    expect(engine.fitsAssignment(lang, einheit('18:30'), new Map())).toBe(true);
    expect(engine.fitsAssignment(lang, einheit('18:00'), new Map())).toBe(false);
  });
});

describe('Speichern', () => {
  it('schreibt die tatsächliche Dauer je Einheit (Abrechnung rechnet damit)', async () => {
    let entries: Array<{ duration_minutes: number }> = [];
    const repo = {
      saveClustering: async (p: { entries: typeof entries }) => {
        entries = p.entries;
        return {};
      },
    };
    const engine = new SeasonClusteringEngine('s', 'c', {}, repo as never) as never as {
      saveToDatabase: (r: unknown) => Promise<void>;
    };
    const g = (startTime: string, endTime: string) => ({
      groupId: 'new:x',
      groupName: 'G',
      trainerId: 't1',
      trainerName: 't1',
      dayOfWeek: 0,
      startTime,
      endTime,
      courtId: null,
      courtName: null,
      maxSize: 4,
      memberIds: ['a', 'b'],
      memberDetails: [],
      waitlistIds: [],
      waitlistDetails: [],
      warnings: [],
      conflictIds: [],
    });

    await engine.saveToDatabase({
      groups: [g('17:00', '19:00'), g('19:00', '20:30')],
      waitlistSummary: [],
    });

    expect(entries.map((e) => e.duration_minutes)).toEqual([120, 90]);
  });
});
