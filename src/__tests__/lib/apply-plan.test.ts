// Läuft gegen die echte DB in der Agent-Lane (Claude Sandbox), weil die Logik
// ausschließlich aus SQL-Updates besteht — ein Mock würde nur die Mocks prüfen.
// Ohne bestückte Sandbox-Saison überspringt der Test sich selbst.

import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/src/infrastructure/persistence/db';
import { clubs, seasons, seasonPlanEntries } from '@/src/infrastructure/persistence/schema';
import { eq, ilike } from 'drizzle-orm';
import { applySlotsToPlanEntries } from '@/lib/season-planning/apply-plan';
import type { ScheduleSlot } from '@/lib/season-planning/types';

let seasonId: string | null = null;

beforeAll(async () => {
  const [row] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .innerJoin(clubs, eq(clubs.id, seasons.club_id))
    .innerJoin(seasonPlanEntries, eq(seasonPlanEntries.season_id, seasons.id))
    .where(ilike(clubs.name, 'Claude Sandbox%'))
    .limit(1);
  seasonId = row?.id ?? null;
});

const loadEntries = (id: string) =>
  db
    .select()
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, id))
    .orderBy(seasonPlanEntries.id);

/** Baut die Slots so, wie das Wizard-Grid sie liefert: id = group_id, Zeit als HH:MM. */
function toSlots(entries: Awaited<ReturnType<typeof loadEntries>>): ScheduleSlot[] {
  return entries
    .filter((e) => e.group_id)
    .map((e) => ({
      id: e.group_id!,
      groupName: 'Test',
      groupColor: '#000',
      trainerId: 'kein-uuid', // muss ignoriert werden, sonst kippt der FK den Save
      trainerName: '',
      dayOfWeek: e.day_of_week,
      startTime: e.start_time.slice(0, 5),
      endTime: e.end_time.slice(0, 5),
      durationMin: e.duration_minutes,
      courtId: e.court_id,
      courtName: null,
      memberIds: (e.expected_participants as string[]) ?? [],
      memberNames: [],
    }));
}

describe('applySlotsToPlanEntries', () => {
  it('schreibt eine Verschiebung in season_plan_entries und dreht sie wieder zurück', async () => {
    if (!seasonId) return; // keine bestückte Sandbox-Saison vorhanden
    const before = (await loadEntries(seasonId)).filter((e) => e.group_id);
    if (before.length === 0) return; // keine verschiebbaren Einträge vorhanden
    const target = before[0];
    const movedDay = (target.day_of_week + 1) % 6;

    const slots = toSlots(before).map((s, i) => (i === 0 ? { ...s, dayOfWeek: movedDay } : s));
    const result = await applySlotsToPlanEntries(seasonId, slots);

    expect(result.missingGroupNames).toEqual([]);
    expect(result.applied).toBeGreaterThan(0);

    const after = await loadEntries(seasonId);
    const moved = after.find((e) => e.id === target.id)!;
    expect(moved.day_of_week).toBe(movedDay);
    expect(moved.planning_source).toBe('manual');
    // "09:30" darf beim Zurückschreiben nicht zu einer anderen Uhrzeit werden
    expect(moved.start_time).toBe(target.start_time);

    await applySlotsToPlanEntries(
      seasonId,
      slots.map((s, i) => (i === 0 ? { ...s, dayOfWeek: target.day_of_week } : s))
    );
    const restored = await loadEntries(seasonId);
    expect(restored.find((e) => e.id === target.id)!.day_of_week).toBe(target.day_of_week);
  });

  it('meldet Gruppen eines alten Standes, die es nicht mehr gibt, statt zu werfen', async () => {
    if (!seasonId) return;
    const slots = toSlots(await loadEntries(seasonId));
    const orphan = { ...slots[0], id: '00000000-0000-0000-0000-000000000000', groupName: 'Weg' };

    const result = await applySlotsToPlanEntries(seasonId, [orphan]);

    expect(result.missingGroupNames).toEqual(['Weg']);
    expect(result.applied).toBe(0);
  });
});
