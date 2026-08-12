/**
 * Von der Nutzer-ID zur Trainer-Datensatz-ID — die eine Auflösung.
 *
 * Warum es diesen Helfer gibt: Im Projekt existierten zwei Vorstellungen davon,
 * was „Trainer-ID" bedeutet.
 *
 *  - Die Domänenschicht (`trainerProfileService`) nimmt an, dass
 *    `trainers.id === users.id`. `ensureTrainersRecord()` legt Trainer genau so an.
 *  - Alle Fremdschlüssel (`trainer_availabilities`, `trainer_absences`, `sessions`)
 *    zeigen auf `trainers.id`.
 *  - Trainer, die über `/api/members/invite`, den CSV-Import oder ein Seed-Skript
 *    entstehen, bekommen aber eine **eigene** `trainers.id` und lediglich ein
 *    gesetztes `user_id`.
 *
 * Messung vom 13.08.2026: Von 65 Trainerzeilen erfüllten **3** die Annahme
 * `id === user_id`, 35 hatten eine abweichende ID, 27 gar keine `user_id`. Jede
 * Abfrage, die `users.id` als `trainer_id` einsetzte, lief für die übrigen ins
 * Leere — die Admin-Ansicht der Verfügbarkeiten war für fast alle Trainer leer,
 * und ein betroffener Trainer konnte seinen eigenen Slot weder anlegen noch löschen.
 *
 * Reihenfolge der Auflösung: `trainers.user_id` (die verlässliche Verknüpfung) →
 * `trainers.id` (Legacy-Zeilen, bei denen beides gleich ist) → nichts.
 */
import { db } from '@/src/infrastructure/persistence/db';
import { trainers } from '@/src/infrastructure/persistence/schema';
import { eq, inArray, or } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('trainer-record');

/**
 * Liefert die `trainers.id` zu einer `users.id` — oder `null`, wenn es zu diesem
 * Nutzer keinen Trainerdatensatz gibt.
 */
export async function resolveTrainerRecordId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: trainers.id, userId: trainers.user_id })
    .from(trainers)
    .where(or(eq(trainers.user_id, userId), eq(trainers.id, userId)));

  if (rows.length === 0) return null;

  // Die Verknüpfung über user_id ist verlässlich; die Gleichheit von id und
  // userId ist nur eine Legacy-Konvention und wird deshalb nachrangig behandelt.
  const byUserId = rows.find((r) => r.userId === userId);
  if (byUserId) return byUserId.id;

  return rows[0].id;
}

/**
 * Dieselbe Auflösung für viele Nutzer auf einmal — eine Abfrage statt N.
 * Nicht auflösbare Nutzer fehlen in der Map.
 */
export async function resolveTrainerRecordIds(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (userIds.length === 0) return result;

  const rows = await db
    .select({ id: trainers.id, userId: trainers.user_id })
    .from(trainers)
    .where(or(inArray(trainers.user_id, userIds), inArray(trainers.id, userIds)));

  // Erst die Legacy-Treffer (id === userId), dann die verlässlichen über user_id —
  // so gewinnt user_id, falls beide existieren.
  for (const row of rows) {
    if (userIds.includes(row.id)) result.set(row.id, row.id);
  }
  for (const row of rows) {
    if (row.userId && userIds.includes(row.userId)) result.set(row.userId, row.id);
  }

  const missing = userIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    log.warn('Zu diesen Nutzern gibt es keinen Trainerdatensatz', { count: missing.length });
  }

  return result;
}
