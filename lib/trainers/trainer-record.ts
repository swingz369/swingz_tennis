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
import { systemDb } from '@/infrastructure/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('trainer-record');

// Identitätsauflösung über Vereinsgrenzen hinweg (Mitglied liest fremde
// Trainer-Slots, RLS gibt `trainers` nur dem Trainer selbst und seinem Admin frei).
const db = () => systemDb('Trainer-ID-Auflösung');

// Werte landen in PostgREST-`or`-Filtern — nur echte UUIDs zulassen.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TrainerRow = { id: string; user_id: string | null };

async function trainerRows(filter: string): Promise<TrainerRow[]> {
  const { data, error } = await db().from('trainers').select('id, user_id').or(filter);
  if (error) throw new Error(`Trainerdatensätze konnten nicht gelesen werden: ${error.message}`);
  return data ?? [];
}

async function activeTrainerUserIds(column: 'user_id' | 'club_id', value: string) {
  const { data, error } = await db()
    .from('user_club_memberships')
    .select('user_id, club_id')
    .eq(column, value)
    .eq('role', 'trainer')
    .eq('is_active', true);
  if (error)
    throw new Error(`Trainer-Mitgliedschaften konnten nicht gelesen werden: ${error.message}`);
  return data ?? [];
}

/**
 * Liefert die `trainers.id` zu einer `users.id` — oder `null`, wenn es zu diesem
 * Nutzer keinen Trainerdatensatz gibt.
 */
export async function resolveTrainerRecordId(userId: string): Promise<string | null> {
  if (!UUID.test(userId)) return null;
  const rows = await trainerRows(`user_id.eq.${userId},id.eq.${userId}`);
  if (rows.length === 0) return null;

  // Die Verknüpfung über user_id ist verlässlich; die Gleichheit von id und
  // userId ist nur eine Legacy-Konvention und wird deshalb nachrangig behandelt.
  return (rows.find((r) => r.user_id === userId) ?? rows[0]).id;
}

/**
 * Ist ein Trainer (trainers.id oder users.id) im Verein `clubId` aktiv als
 * Trainer? Wird gebraucht, wo ein Mitglied über den Service-Client fremde
 * Trainer-Slots liest/bucht und die Vereinsgrenze explizit geprüft werden muss,
 * weil RLS diese Zeilen für Mitglieder nicht freigibt. Prüft gegen alle Vereine
 * des Trainers — Trainer dürfen in mehreren Vereinen aktiv sein.
 */
export async function isTrainerInClub(trainerId: string, clubId: string): Promise<boolean> {
  if (!UUID.test(trainerId)) return false;
  const rows = await trainerRows(`id.eq.${trainerId},user_id.eq.${trainerId}`);
  if (rows.length === 0) return false;

  const row = rows.find((r) => r.user_id) ?? rows[0];
  const memberships = await activeTrainerUserIds('user_id', row.user_id ?? row.id);
  return memberships.some((m) => m.club_id === clubId);
}

/**
 * Dieselbe Auflösung für viele Nutzer auf einmal — eine Abfrage statt N.
 * Nicht auflösbare Nutzer fehlen in der Map.
 */
export async function resolveTrainerRecordIds(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ids = userIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return result;

  const list = ids.join(',');
  const rows = await trainerRows(`user_id.in.(${list}),id.in.(${list})`);

  // Erst die Legacy-Treffer (id === userId), dann die verlässlichen über user_id —
  // so gewinnt user_id, falls beide existieren.
  for (const row of rows) {
    if (ids.includes(row.id)) result.set(row.id, row.id);
  }
  for (const row of rows) {
    if (row.user_id && ids.includes(row.user_id)) result.set(row.user_id, row.id);
  }

  const missing = userIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    log.warn('Zu diesen Nutzern gibt es keinen Trainerdatensatz', { count: missing.length });
  }

  return result;
}

/**
 * Alle `trainers.id`, die aktiv als Trainer in einem Verein sind — für Abfragen,
 * die "alle Trainer dieses Vereins" statt eines einzelnen brauchen (z. B. der
 * Kalender, der Trainerstunden vereinsweit anzeigt).
 */
export async function resolveClubTrainerRecordIds(clubId: string): Promise<string[]> {
  const memberships = await activeTrainerUserIds('club_id', clubId);
  const userIds = memberships.map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const ids = await resolveTrainerRecordIds(userIds);
  return Array.from(new Set(ids.values()));
}
