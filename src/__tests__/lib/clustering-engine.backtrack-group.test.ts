/**
 * Regressionstests: Backtracking verschiebt Gruppen, löst sie aber nie auf.
 *
 * Bis 27.09.2026 wurde eine Gruppe ohne Ausweichtermin aufgelöst und ihr Termin an EIN
 * übriges Mitglied als Einzeltraining vergeben — ohne Niveau-, Alters- oder Uhrzeitprüfung.
 * Aus einer Zweiergruppe wurde so ein Einzeltraining für jemand anderen.
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

const member = (id: string, availability: object) =>
  ({
    id,
    name: id,
    email: '',
    skillLevel: 'intermediate',
    experienceMonths: 12,
    promotedLevel: null,
    avoidMemberIds: [],
    wishPartnerIds: [],
    preferredCourtIds: [],
    preferredGroupIds: [],
    previousGroupId: null,
    isMinor: false,
    priority: 5,
    availability: { ...leer, ...availability },
  }) as never;

const trainer = {
  id: 't1',
  name: 'Trainer',
  specialties: [],
  maxHoursPerWeek: 30,
  utilizationPct: 100,
  availability: { ...leer, monday: [{ start: '17:00', end: '19:00' }] },
  maxSessionsPerWeek: 20,
  preferredCourtIds: [],
  canTeachGroups: [],
  sessionsAssigned: 0,
};

const gruppe = (memberIds: string[]): GroupAssignment =>
  ({
    groupId: 'new:gruppe',
    groupName: 'Mittel Gruppe 1',
    trainerId: 't1',
    trainerName: 'Trainer',
    dayOfWeek: 0,
    startTime: '17:00',
    endTime: '18:00',
    courtId: null,
    courtName: null,
    maxSize: 4,
    memberIds,
    memberDetails: memberIds.map((memberId) => ({ memberId, memberName: memberId })),
    waitlistIds: [],
    waitlistDetails: [],
    warnings: [],
    conflictIds: [],
  }) as never;

type Engine = {
  pendingGroups: Map<string, { name: string; level: string; ageGroup: string }>;
  backtrackForUnassigned: (...args: unknown[]) => Promise<number>;
};

async function backtrack(
  members: unknown[],
  unassigned: unknown[],
  assignments: GroupAssignment[]
) {
  const engine = new SeasonClusteringEngine('season', 'club', {
    groupMinSize: 1,
  }) as never as Engine;
  engine.pendingGroups.set('new:gruppe', {
    name: 'Mittel Gruppe 1',
    level: 'intermediate',
    ageGroup: 'adult',
  });
  const assigned = new Set(assignments.flatMap((a) => a.memberIds));
  await engine.backtrackForUnassigned(
    unassigned,
    members,
    [trainer],
    [],
    new Map(),
    {},
    [
      { start: '17:00', end: '18:00' },
      { start: '18:00', end: '19:00' },
    ],
    new Map([['t1', assignments.length]]),
    new Map(),
    assignments,
    assigned,
    1,
    3,
    0
  );
  return assigned;
}

describe('Backtracking', () => {
  it('lässt eine Gruppe ohne Ausweichtermin unangetastet', async () => {
    const nur17 = { monday: [{ start: '17:00', end: '18:00' }] };
    const a = member('a', nur17);
    const b = member('b', nur17);
    const z = member('z', nur17);
    const assignments = [gruppe(['a', 'b'])];

    const assigned = await backtrack([a, b, z], [z], assignments);

    expect(assignments).toHaveLength(1);
    expect(assignments[0].memberIds).toEqual(['a', 'b']);
    expect([...assigned].sort()).toEqual(['a', 'b']);
  });

  it('verschiebt eine Gruppe, damit ein übriges Mitglied einen Platz bekommt', async () => {
    // Die Gruppe kann auch 18 Uhr, das übrige Mitglied nur 17 Uhr — ein Trainer.
    const flexibel = { monday: [{ start: '17:00', end: '19:00' }] };
    const a = member('a', flexibel);
    const b = member('b', flexibel);
    const z = member('z', { monday: [{ start: '17:00', end: '18:00' }] });
    const assignments = [gruppe(['a', 'b'])];

    const assigned = await backtrack([a, b, z], [z], assignments);

    expect([...assigned].sort()).toEqual(['a', 'b', 'z']);
    const alt = assignments.find((g) => g.memberIds.includes('a'))!;
    expect(alt.memberIds).toEqual(['a', 'b']);
    expect(alt.startTime).toBe('18:00');
    const neu = assignments.find((g) => g.memberIds.includes('z'))!;
    expect(neu.startTime).toBe('17:00');
    // Neue Gruppe ist ein Platzhalter, der beim Speichern angelegt wird.
    expect(neu.groupId).toMatch(/^new:/);
  });
});
