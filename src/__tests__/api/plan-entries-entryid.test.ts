/**
 * Verhaltens-Tests für PATCH /api/seasons/[id]/plan-entries/[entryId] —
 * bisher ungetestet trotz Komplexität 53 (Fund 16.09.2026, tokensave
 * test_risk). Deckt Rollen-/Club-Guards, Validierung (Wertebereich,
 * Sonntags-Sperre, Zeitfenster, "keine bekannten Felder"), Terminkonflikt-
 * erkennung und die Nachrück-Logik von der Saison-Warteliste ab.
 *
 * Die Route greift direkt über Drizzle (`@/src/infrastructure/persistence/db`)
 * zu, nicht über `auth.supabase` — deshalb zusätzlich zum Harness aus
 * ../helpers/api-route ein lokaler Drizzle-Mock nach dem in
 * src/__tests__/api/confirm-publish.test.ts etablierten Muster (echte
 * eq/and/sql aus drizzle-orm scheitern an den simplen Mock-Schema-Objekten,
 * deshalb ebenfalls gemockt).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.mock('@/lib/csrf', () => ({
  withCSRFProtection: vi.fn((_req: unknown, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: { max: 100, windowMs: 60000, message: 'Zu viele Anfragen.' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    sql: vi.fn(() => ({})),
  };
});

vi.mock('@/src/infrastructure/persistence/schema', () => ({
  seasonPlanEntries: { _table: 'season_plan_entries' },
  trainers: { _table: 'trainers' },
  courts: { _table: 'courts' },
  groups: { _table: 'groups' },
}));

const mockPromote = vi.fn(async () => [] as { memberId: string; position: number }[]);
vi.mock('@/lib/season-planning/waitlist-promotion', () => ({
  promoteFromSeasonWaitlist: (...args: unknown[]) => mockPromote(...(args as [string, string])),
}));

// ── Queue-basierter Drizzle-Mock: PATCH führt der Reihe nach select()
// (existingEntry), optional ein zweites select() (Konfliktsuche) und
// zuletzt update() aus. Jeder Testfall füllt `selectQueue`/`updateResult`.
let selectQueue: unknown[][] = [];
let updateResult: unknown[] = [];

function buildDb() {
  let selectCall = 0;
  return {
    select: () => {
      const c: any = {};
      c.from = () => c;
      c.leftJoin = () => c;
      c.where = () => c;
      c.then = (resolve: (v: unknown) => unknown) => {
        resolve(selectQueue[selectCall] ?? []);
        selectCall++;
        return c;
      };
      return c;
    },
    update: () => {
      const c: any = {};
      c.set = () => c;
      c.where = () => c;
      c.returning = () => c;
      c.then = (resolve: (v: unknown) => unknown) => {
        resolve(updateResult);
        return c;
      };
      return c;
    },
    delete: () => {
      const c: any = {};
      c.where = () => c;
      c.then = (resolve: (v: unknown) => unknown) => {
        resolve([]);
        return c;
      };
      return c;
    },
  };
}

let mockDb: any;
vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        return mockDb[prop];
      },
    }
  ),
}));

const { PATCH } = await import('@/app/api/seasons/[id]/plan-entries/[entryId]/route');

const SEASON_ID = 'season-1';
const ENTRY_ID = 'entry-1';

const BASE_ENTRY = {
  id: ENTRY_ID,
  season_id: SEASON_ID,
  club_id: 'club-1',
  trainer_id: 'trainer-1',
  court_id: 'court-1',
  group_id: 'group-1',
  day_of_week: 2,
  start_time: '17:00:00',
  end_time: '18:00:00',
  duration_minutes: 60,
  entry_type: 'training',
  max_participants: 8,
  expected_participants: ['member-1', 'member-2'],
  status: 'draft',
};

function makeParams(id = SEASON_ID, entryId = ENTRY_ID) {
  return { params: Promise.resolve({ id, entryId }) };
}

function patchRequest(body: unknown) {
  return makeApiRequest(`http://localhost/api/seasons/${SEASON_ID}/plan-entries/${ENTRY_ID}`, {
    method: 'PATCH',
    json: body,
  });
}

describe('PATCH /api/seasons/[id]/plan-entries/[entryId]', () => {
  beforeEach(() => {
    supa.reset();
    mockDb = buildDb();
    selectQueue = [[BASE_ENTRY]];
    updateResult = [{ ...BASE_ENTRY, notes: 'aktualisiert' }];
    mockPromote.mockReset().mockResolvedValue([]);
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('liefert 404, wenn der Plan-Eintrag nicht existiert', async () => {
    supa.setRole('admin', 'club-1');
    selectQueue = [[]];
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt Zugriff auf einen Plan-Eintrag eines anderen Vereins ab', async () => {
    supa.setRole('admin', 'club-1');
    selectQueue = [[{ ...BASE_ENTRY, club_id: 'club-OTHER' }]];
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt einen day_of_week außerhalb 0-6 ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ day_of_week: 9 }), makeParams());
    expect(res.status).toBe(400);
  });

  it('lehnt Trainingsstunden an einem Sonntag ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ day_of_week: 6 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('Sonntag');
  });

  it('lehnt einen Request ohne bekannte Felder ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ unknownField: 'x' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('lehnt start_time >= end_time ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(
      patchRequest({ start_time: '19:00:00', end_time: '18:00:00' }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('liefert 409 bei einem erkannten Terminkonflikt', async () => {
    supa.setRole('admin', 'club-1');
    selectQueue = [
      [BASE_ENTRY],
      [{ id: 'other-entry', day_of_week: 2, start_time: '17:00:00', end_time: '18:00:00' }],
    ];
    const res = await PATCH(patchRequest({ trainer_id: 'trainer-2' }), makeParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('Terminkonflikt');
  });

  it('aktualisiert einen Plan-Eintrag bei gültiger Anfrage', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ notes: 'Neue Notiz' }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.entry.notes).toBe('aktualisiert');
    expect(body.promoted).toEqual([]);
  });

  // Wird die Teilnehmerliste kleiner, rückt die Saison-Warteliste nach —
  // sonst bliebe ein frei gewordener Platz leer, obwohl jemand wartet.
  it('rückt bei kleinerer Teilnehmerliste von der Warteliste nach', async () => {
    supa.setRole('admin', 'club-1');
    updateResult = [{ ...BASE_ENTRY, expected_participants: ['member-1'] }];
    mockPromote.mockResolvedValue([{ memberId: 'member-3', position: 1 }]);

    const res = await PATCH(patchRequest({ expected_participants: ['member-1'] }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.promoted).toEqual([{ memberId: 'member-3', position: 1 }]);
    expect(mockPromote).toHaveBeenCalledWith(SEASON_ID, 'group-1');
  });

  it('rückt NICHT nach, wenn die Teilnehmerliste größer wird', async () => {
    supa.setRole('admin', 'club-1');
    updateResult = [{ ...BASE_ENTRY, expected_participants: ['member-1', 'member-2', 'member-3'] }];
    const res = await PATCH(
      patchRequest({ expected_participants: ['member-1', 'member-2', 'member-3'] }),
      makeParams()
    );
    expect(res.status).toBe(200);
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
