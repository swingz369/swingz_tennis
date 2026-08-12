import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `trainer_availabilities.trainer_id` ist ein Fremdschlüssel auf `trainers.id`.
 * Die Domänenschicht nahm an, dass diese ID der `users.id` entspricht — was für
 * 3 von 65 Trainerzeilen zutraf. Für alle anderen fand jede Abfrage nichts.
 */

const rows: { id: string; userId: string | null }[] = [];

vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  },
}));

vi.mock('@/src/infrastructure/persistence/schema', () => ({
  trainers: { id: 'trainers.id', user_id: 'trainers.user_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  or: (...args: unknown[]) => args,
  inArray: (a: unknown, b: unknown) => ({ a, b }),
}));

const { resolveTrainerRecordId, resolveTrainerRecordIds } =
  await import('@/lib/trainers/trainer-record');

const setRows = (next: { id: string; userId: string | null }[]) => {
  rows.length = 0;
  rows.push(...next);
};

describe('resolveTrainerRecordId', () => {
  beforeEach(() => setRows([]));

  it('liefert die trainers.id, wenn sie von der users.id abweicht', async () => {
    setRows([{ id: 'trainer-1', userId: 'user-1' }]);
    expect(await resolveTrainerRecordId('user-1')).toBe('trainer-1');
  });

  it('kommt mit Legacy-Zeilen zurecht, bei denen beide IDs gleich sind', async () => {
    setRows([{ id: 'user-2', userId: 'user-2' }]);
    expect(await resolveTrainerRecordId('user-2')).toBe('user-2');
  });

  it('bevorzugt die Verknüpfung über user_id gegenüber der Legacy-Gleichheit', async () => {
    // Beide Zeilen passen zur Suche; verlässlich ist die über user_id.
    setRows([
      { id: 'user-3', userId: null },
      { id: 'trainer-3', userId: 'user-3' },
    ]);
    expect(await resolveTrainerRecordId('user-3')).toBe('trainer-3');
  });

  it('meldet null, wenn es zu diesem Nutzer keinen Trainerdatensatz gibt', async () => {
    setRows([]);
    expect(await resolveTrainerRecordId('user-4')).toBeNull();
  });
});

describe('resolveTrainerRecordIds', () => {
  beforeEach(() => setRows([]));

  it('löst mehrere Nutzer in einer Abfrage auf', async () => {
    setRows([
      { id: 'trainer-1', userId: 'user-1' },
      { id: 'user-2', userId: 'user-2' },
    ]);
    const map = await resolveTrainerRecordIds(['user-1', 'user-2']);
    expect(map.get('user-1')).toBe('trainer-1');
    expect(map.get('user-2')).toBe('user-2');
  });

  it('lässt Nutzer ohne Trainerdatensatz weg, statt zu raten', async () => {
    setRows([{ id: 'trainer-1', userId: 'user-1' }]);
    const map = await resolveTrainerRecordIds(['user-1', 'user-unbekannt']);
    expect(map.has('user-unbekannt')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('gibt bei leerer Eingabe eine leere Map zurück, ohne die Datenbank zu fragen', async () => {
    const map = await resolveTrainerRecordIds([]);
    expect(map.size).toBe(0);
  });
});
