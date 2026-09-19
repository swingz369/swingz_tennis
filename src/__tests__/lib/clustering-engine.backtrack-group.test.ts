/**
 * Regressionstest: Backtracking-Einzelzuweisungen müssen echte Gruppen werden.
 *
 * Früher trugen sie eine synthetische ID (`backtrack-<n>-<memberId>`) ohne Platzhalter-Eintrag:
 * `saveToDatabase` legte keine Gruppe an, der Planeintrag bekam `group_id = null` und alle
 * Wartelisteneinträge dieser Gruppe fielen weg. Jetzt ist die Ersatzgruppe ein `new:`-Platzhalter
 * in `pendingGroups` und wird beim Speichern als DB-Zeile angelegt.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';
import type { GroupAssignment } from '@/lib/season-planning/types';

const member = (id: string, name: string) =>
  ({
    id,
    name,
    email: '',
    skillLevel: 'intermediate',
    experienceMonths: 12,
    promotedLevel: null,
    avoidMemberIds: [],
    isMinor: false,
    availability: { monday: [{ start: '17:00', end: '19:00' }] },
  }) as never;

const victim: GroupAssignment = {
  groupId: '11111111-1111-4111-8111-111111111111',
  groupName: 'Mittel Gruppe 1',
  trainerId: 'trainer-1',
  trainerName: 'Trainer',
  dayOfWeek: 0,
  startTime: '17:00',
  endTime: '18:00',
  courtId: null,
  courtName: null,
  maxSize: 4,
  memberIds: ['a'],
  memberDetails: [{ memberId: 'a', memberName: 'Anna' }] as never,
  waitlistIds: [],
  waitlistDetails: [],
  warnings: [],
  conflictIds: [],
} as never;

describe('Backtracking-Ersatzgruppe', () => {
  it('ist ein Platzhalter in pendingGroups und keine synthetische backtrack-ID', async () => {
    const engine = new SeasonClusteringEngine('season', 'club', {}) as never as {
      pendingGroups: Map<string, { name: string; level: string; ageGroup: string }>;
      backtrackForUnassigned: (...args: unknown[]) => Promise<void>;
    };
    const anna = member('a', 'Anna');
    const ben = member('b', 'Ben');
    const assignments: GroupAssignment[] = [{ ...victim }];

    await engine.backtrackForUnassigned(
      [ben],
      [],
      new Map(),
      [anna, ben],
      [],
      [],
      new Map(),
      {},
      [],
      new Map(),
      new Map(),
      assignments,
      new Set(['a']),
      1
    );

    const solo = assignments.find((g) => g.warnings.some((w) => w.includes('Backtracking')));
    expect(solo).toBeDefined();
    expect(solo!.groupId).toMatch(/^new:/);
    expect(solo!.groupId).not.toContain('backtrack');
    expect(engine.pendingGroups.get(solo!.groupId)).toMatchObject({
      level: 'intermediate',
      ageGroup: 'adult',
    });
    expect(solo!.groupName).toMatch(/^Einzeltraining /);
  });
});
