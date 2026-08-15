// Schreibt den im Wizard bearbeiteten Wochenstundenplan zurück in season_plan_entries.
//
// Grund: Der Wizard hielt das verschobene Raster ausschließlich im React-State. Beim
// Bestätigen liest app/api/seasons/[id]/planning/confirm die Termine aber aus der
// Datenbank — jede Korrektur per Drag & Drop war damit spätestens beim Publish weg.
//
// Zuordnung läuft über group_id (= ScheduleSlot.id). Seit dem Dedupe in
// clustering-engine.ts (eine bereits verplante Gruppe wird nicht erneut vergeben)
// ist diese ID pro Plan eindeutig.

import { db } from '@/src/infrastructure/persistence/db';
import { seasonPlanEntries } from '@/src/infrastructure/persistence/schema';
import { eq, inArray } from 'drizzle-orm';
import type { ScheduleSlot } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "09:30" | "09:30:00" → "09:30:00" (Spaltentyp ist `time`) */
function toSqlTime(value: string): string {
  const [h = '00', m = '00'] = value.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
}

export interface ApplyPlanResult {
  /** Anzahl tatsächlich aktualisierter Termine */
  applied: number;
  /** Gruppen aus der Vorlage, zu denen es keinen Termin mehr gibt */
  missingGroupNames: string[];
}

export async function applySlotsToPlanEntries(
  seasonId: string,
  slots: ScheduleSlot[]
): Promise<ApplyPlanResult> {
  const entries = await db
    .select({ id: seasonPlanEntries.id, group_id: seasonPlanEntries.group_id })
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, seasonId));

  const entryIdsByGroup = new Map<string, string[]>();
  for (const e of entries) {
    if (!e.group_id) continue;
    const list = entryIdsByGroup.get(e.group_id) ?? [];
    list.push(e.id);
    entryIdsByGroup.set(e.group_id, list);
  }

  let applied = 0;
  const missingGroupNames: string[] = [];

  for (const slot of slots) {
    const ids = entryIdsByGroup.get(slot.id);
    if (!ids || ids.length === 0) {
      // Kommt vor, wenn ein Stand nach einer Neugenerierung zurückgeholt wird und
      // eine Gruppe dabei nicht mehr entstanden ist. Der Rest wird trotzdem gesetzt.
      missingGroupNames.push(slot.groupName);
      continue;
    }

    await db
      .update(seasonPlanEntries)
      .set({
        day_of_week: slot.dayOfWeek,
        start_time: toSqlTime(slot.startTime),
        end_time: toSqlTime(slot.endTime),
        duration_minutes: slot.durationMin,
        court_id: slot.courtId,
        expected_participants: slot.memberIds,
        // Der Bearbeiten-Dialog ändert nur den Trainer-Namen, nicht die ID. Gesetzt
        // wird sie nur, wenn sie plausibel ist — sonst kippt der FK den ganzen Save.
        ...(UUID_RE.test(slot.trainerId) ? { trainer_id: slot.trainerId } : {}),
        planning_source: 'manual',
        updated_at: new Date(),
      })
      .where(inArray(seasonPlanEntries.id, ids));

    applied += ids.length;
  }

  return { applied, missingGroupNames };
}
