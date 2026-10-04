import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `trainer_availabilities.trainer_id` ist ein Fremdschlüssel auf `trainers.id`.
 * Die Domänenschicht nahm an, dass diese ID der `users.id` entspricht — was für
 * 3 von 65 Trainerzeilen zutraf. Für alle anderen fand jede Abfrage nichts.
 */

const rows: { id: string; user_id: string | null }[] = [];
const filters: string[] = [];

vi.mock('@/infrastructure/db', () => ({
  systemDb: () => ({
    from: () => ({
      select: () => ({
        or: async (filter: string) => {
          filters.push(filter);
          return { data: rows, error: null };
        },
      }),
    }),
  }),
}));

const { resolveTrainerRecordId, resolveTrainerRecordIds } =
  await import('@/lib/trainers/trainer-record');

// Kurzschreibweise: 'user-1' → stabile UUID, damit die Fälle lesbar bleiben.
const ids = new Map<string, string>();
const U = (name: string) => {
  if (!ids.has(name))
    ids.set(name, `00000000-0000-4000-8000-${String(ids.size + 1).padStart(12, '0')}`);
  return ids.get(name)!;
};

const setRows = (next: { id: string; userId: string | null }[]) => {
  rows.length = 0;
  rows.push(...next.map((r) => ({ id: U(r.id), user_id: r.userId && U(r.userId) })));
};

describe('resolveTrainerRecordId', () => {
  beforeEach(() => setRows([]));

  it('liefert die trainers.id, wenn sie von der users.id abweicht', async () => {
    setRows([{ id: 'trainer-1', userId: 'user-1' }]);
    expect(await resolveTrainerRecordId(U('user-1'))).toBe(U('trainer-1'));
  });

  it('kommt mit Legacy-Zeilen zurecht, bei denen beide IDs gleich sind', async () => {
    setRows([{ id: 'user-2', userId: 'user-2' }]);
    expect(await resolveTrainerRecordId(U('user-2'))).toBe(U('user-2'));
  });

  it('bevorzugt die Verknüpfung über user_id gegenüber der Legacy-Gleichheit', async () => {
    // Beide Zeilen passen zur Suche; verlässlich ist die über user_id.
    setRows([
      { id: 'user-3', userId: null },
      { id: 'trainer-3', userId: 'user-3' },
    ]);
    expect(await resolveTrainerRecordId(U('user-3'))).toBe(U('trainer-3'));
  });

  it('meldet null, wenn es zu diesem Nutzer keinen Trainerdatensatz gibt', async () => {
    setRows([]);
    expect(await resolveTrainerRecordId(U('user-4'))).toBeNull();
  });
});

describe('resolveTrainerRecordIds', () => {
  beforeEach(() => setRows([]));

  it('löst mehrere Nutzer in einer Abfrage auf', async () => {
    setRows([
      { id: 'trainer-1', userId: 'user-1' },
      { id: 'user-2', userId: 'user-2' },
    ]);
    const map = await resolveTrainerRecordIds([U('user-1'), U('user-2')]);
    expect(map.get(U('user-1'))).toBe(U('trainer-1'));
    expect(map.get(U('user-2'))).toBe(U('user-2'));
  });

  it('lässt Nutzer ohne Trainerdatensatz weg, statt zu raten', async () => {
    setRows([{ id: 'trainer-1', userId: 'user-1' }]);
    const map = await resolveTrainerRecordIds([U('user-1'), U('user-unbekannt')]);
    expect(map.has(U('user-unbekannt'))).toBe(false);
    expect(map.size).toBe(1);
  });

  it('gibt bei leerer Eingabe eine leere Map zurück, ohne die Datenbank zu fragen', async () => {
    filters.length = 0;
    const map = await resolveTrainerRecordIds([]);
    expect(map.size).toBe(0);
    expect(filters).toEqual([]);
  });

  it('lässt keine Nicht-UUID in den PostgREST-Filter', async () => {
    filters.length = 0;
    expect(await resolveTrainerRecordId('x),id.neq.(0')).toBeNull();
    const map = await resolveTrainerRecordIds(['x,user_id.not.is.null']);
    expect(map.size).toBe(0);
    expect(filters).toEqual([]);
  });
});
