/**
 * Unit tests for POST /api/seasons/[id]/planning/confirm
 *
 * Focus: transaction rollback — if any DB write inside the transaction
 * fails, all prior writes (sessions, plan entries, season status, conflicts,
 * audit trail) must be rolled back.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// Ensure DATABASE_URL is set before any dynamic import triggers db.ts module evaluation.
// CI environments may not have DATABASE_URL, and vi.mock hoisting may not intercept
// dynamic imports in all Vitest configurations.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/swingz_test';
import { NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const SEASON_ID = 'season-001';
const CLUB_ID = 'club-001';
const USER_ID = 'user-admin-001';
const TRAINER_ID = 'trainer-001';

// ════════════════════════════════════════════════════════════
// CHAINABLE QUERY BUILDER
// ════════════════════════════════════════════════════════════

/**
 * Creates a chainable mock that resolves to `result`.
 * If `result` is an Error, it throws instead of resolving.
 */
function chain(result: unknown): any {
  const c: any = {};
  // Chain methods — all return self
  for (const key of ['from', 'where', 'limit', 'set', 'values', 'returning', 'order']) {
    c[key] = vi.fn(() => c);
  }
  // thenable — makes `await` work
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    if (result instanceof Error) {
      reject(result);
    } else {
      resolve(result);
    }
    return c;
  };
  return c;
}

// ════════════════════════════════════════════════════════════
// DEFAULT FIXTURES
// ════════════════════════════════════════════════════════════

const DEFAULT_SEASON = {
  id: SEASON_ID,
  club_id: CLUB_ID,
  name: 'Sommersaison 2025',
  year: 2025,
  start_date: '2025-05-01',
  end_date: '2025-08-31',
  planning_status: 'collecting_preferences',
};

const DEFAULT_ENTRY = {
  id: 'entry-001',
  season_id: SEASON_ID,
  trainer_id: TRAINER_ID,
  group_id: 'group-001',
  court_id: 'court-001',
  day_of_week: 2,
  start_time: '17:00:00',
  end_time: '18:30:00',
  duration_minutes: 90,
  max_participants: 10,
  expected_participants: ['member-001', 'member-002'],
  status: 'draft',
  starts_from_week: 1,
  ends_at_week: 16,
};

const DEFAULT_SCHEDULE = { id: 'schedule-existing' };
const DEFAULT_NEW_SCHEDULE_ID = 'schedule-new-001';

const DEFAULT_SESSIONS = Array.from({ length: 16 }, (_, i) => ({
  id: `session-w${i + 1}`,
}));

const DEFAULT_USERS = [
  { id: 'member-001', email: 'max@test.com', full_name: 'Max Mustermann' },
  { id: 'member-002', email: 'anna@test.com', full_name: 'Anna Schmidt' },
];

// ════════════════════════════════════════════════════════════
// CONFIGURABLE MOCK STATE
// ════════════════════════════════════════════════════════════

interface MockConfig {
  /** Season query result (empty array → 404) */
  season: unknown[];
  /** Plan entries query result */
  entries: unknown[];
  /** Club query result (for bundesland/holiday resolution) */
  club: unknown[];
  /** Existing schedule (empty array → no schedule, triggers insert) */
  schedule: unknown[];
  /** ID returned from schedule insert */
  newScheduleId: string;
  /** Session insert results (one per week) */
  sessions: unknown[];
  /** Bestehende künftige Sessions, die beim erneuten Veröffentlichen wegfallen */
  staleSessions: unknown[];
  /** User email query result */
  users: unknown[];
  /** If set, the Nth session insert (0-indexed) throws this error */
  failSessionAtWeek?: number;
  /** If set, schedule insert throws */
  failScheduleInsert?: Error;
  /** If set, season update throws */
  failSeasonUpdate?: Error;
  /** If set, audit trail insert throws */
  failAuditTrail?: Error;
  /** If set, conflict persistence throws */
  failConflictPersist?: Error;
  /** If set, the entire transaction callback throws immediately */
  failTransaction?: Error;
  /** Critical conflicts to detect */
  criticalConflicts: unknown[];
}

let config: MockConfig;

function resetConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  config = {
    season: [DEFAULT_SEASON],
    entries: [DEFAULT_ENTRY],
    club: [{ bundesland: null }],
    schedule: [DEFAULT_SCHEDULE],
    newScheduleId: DEFAULT_NEW_SCHEDULE_ID,
    sessions: DEFAULT_SESSIONS,
    staleSessions: [],
    users: DEFAULT_USERS,
    criticalConflicts: [],
    ...overrides,
  };
  return config;
}

// ════════════════════════════════════════════════════════════
// MOCK — getDb() returns a configurable mock DB
// ════════════════════════════════════════════════════════════

let sessionInsertCount = 0;

function createTx(): any {
  const tx: any = {};

  tx.select = (..._args: unknown[]) => {
    // Zwei SELECTs laufen in der Transaktion: die bestehende Schedule
    // (`from(schedules)`) und beim erneuten Veröffentlichen die künftigen
    // Sessions (`from(sessions)`), die verworfen werden.
    const c: any = {};
    let table = '';
    c.from = vi.fn((t?: unknown) => {
      table = typeof t === 'object' && t !== null ? ((t as any)._table ?? '') : '';
      return c;
    });
    c.where = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve(table === 'sessions' ? config.staleSessions : config.schedule);
      return c;
    };
    return c;
  };

  tx.insert = vi.fn((_table: unknown) => {
    const c: any = {};
    c.values = vi.fn(() => c);
    c.returning = vi.fn(() => c);
    c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const tableStr: string =
        typeof _table === 'object' && _table !== null ? ((_table as any)._table ?? '') : '';

      if (tableStr === 'season_planning_history') {
        if (config.failAuditTrail) {
          reject(config.failAuditTrail);
        } else {
          resolve([{ id: 'history-001' }]);
        }
      } else if (tableStr === 'schedules') {
        if (config.failScheduleInsert) {
          reject(config.failScheduleInsert);
        } else {
          resolve([{ id: config.newScheduleId }]);
        }
      } else if (tableStr === 'sessions') {
        const idx = sessionInsertCount++;
        if (config.failSessionAtWeek !== undefined && idx === config.failSessionAtWeek) {
          reject(new Error('Session insert failed (simulated)'));
        } else {
          const sid =
            (config.sessions[idx] as { id: string } | undefined)?.id ?? `session-auto-${idx}`;
          resolve([{ id: sid }]);
        }
      } else {
        resolve([{ id: 'auto-id' }]);
      }
      return c;
    };
    return c;
  });

  tx.update = vi.fn((_table: unknown) => {
    const c: any = {};
    c.set = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const tableStr: string =
        typeof _table === 'object' && _table !== null ? ((_table as any)._table ?? '') : '';
      if (tableStr === 'seasons') {
        if (config.failSeasonUpdate) {
          reject(config.failSeasonUpdate);
        } else {
          resolve([]);
        }
      } else {
        // season_plan_entries update — always succeeds
        resolve([]);
      }
      return c;
    };
    return c;
  });

  tx.delete = vi.fn(() => chain([]));

  return tx;
}

// The global DB — used outside the transaction (season lookup, entry lookup,
// post-transaction user lookup)
let mockGetDb: any;

// ── vi.mock calls (hoisted to module top) ───────────────────

// Mock drizzle-orm's SQL functions while preserving all other exports.
// The real implementations introspect Column objects and fail on our plain
// mock schema objects, so eq/and/inArray return harmless empty mocks.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    gte: vi.fn(() => ({})),
    inArray: vi.fn(() => ({})),
  };
});

vi.mock('@/src/infrastructure/persistence/db', () => {
  // Proxy so that db.select / db.transaction / db.insert etc. delegate to
  // the mockGetDb() instance which is rebuilt per-test in beforeEach.
  const dbProxy = new Proxy({} as any, {
    get(_target, prop) {
      const db = mockGetDb();
      return db[prop];
    },
  });
  return { db: dbProxy };
});

vi.mock('@/src/infrastructure/persistence/schema', () => ({
  bookings: {
    _table: 'bookings',
    id: 'bookings_table',
    club_id: 'club_id',
    member_id: 'member_id',
    schedule_id: 'schedule_id',
    session_id: 'session_id',
    court_id: 'court_id',
    status: 'status',
    session_start_time: 'session_start_time',
  },
  seasons: {
    _table: 'seasons',
    id: 'seasons_table',
    name: 'seasons',
    club_id: 'club_id',
    start_date: 'start_date',
    end_date: 'end_date',
    planning_status: 'planning_status',
  },
  seasonPlanEntries: {
    _table: 'season_plan_entries',
    id: 'season_plan_entries',
    season_id: 'season_id',
    trainer_id: 'trainer_id',
    group_id: 'group_id',
    court_id: 'court_id',
    day_of_week: 'day_of_week',
    start_time: 'start_time',
    end_time: 'end_time',
    duration_minutes: 'duration_minutes',
    max_participants: 'max_participants',
    expected_participants: 'expected_participants',
    status: 'status',
    starts_from_week: 'starts_from_week',
    ends_at_week: 'ends_at_week',
    published_session_id: 'published_session_id',
    published_at: 'published_at',
  },
  sessions: {
    _table: 'sessions',
    id: 'sessions_table',
    plan_entry_id: 'plan_entry_id',
    schedule_id: 'schedule_id',
    trainer_id: 'trainer_id',
    group_ids: 'group_ids',
    week_number: 'week_number',
    timeslot_start: 'timeslot_start',
    timeslot_end: 'timeslot_end',
    court_id: 'court_id',
    max_participants: 'max_participants',
    notes: 'notes',
  },
  schedules: {
    _table: 'schedules',
    id: 'schedules_table',
    club_id: 'club_id',
    season_year: 'season_year',
    season_type: 'season_type',
    season_start_date: 'season_start_date',
    season_end_date: 'season_end_date',
    is_active: 'is_active',
  },
  seasonPlanningHistory: {
    _table: 'season_planning_history',
    id: 'season_planning_history',
    season_id: 'season_id',
    club_id: 'club_id',
    action_type: 'action_type',
    actor_id: 'actor_id',
    actor_role: 'actor_role',
    details: 'details',
    entries_affected: 'entries_affected',
    conflicts_created: 'conflicts_created',
    conflicts_resolved: 'conflicts_resolved',
    notes: 'notes',
  },
  // Column-like objects needed for drizzle-orm functions (inArray, eq) to work
  users: {
    _table: 'users',
    id: { name: 'id' },
    email: { name: 'email' },
    full_name: { name: 'full_name' },
  },
  clubs: {
    _table: 'clubs',
    id: { name: 'id' },
    bundesland: { name: 'bundesland' },
  },
  seasonGroupWeeks: {
    _table: 'season_group_weeks',
    season_id: 'season_id',
    group_id: 'group_id',
    club_id: 'club_id',
    week_number: 'week_number',
    is_active: 'is_active',
  },
}));

// ── Holiday checking (now integrated into the session creation loop) ───
const mockIsDateInHolidays = vi.fn().mockReturnValue(false);
const mockGetHolidaysForState = vi.fn().mockResolvedValue([]);
const mockResolveBundeslandCode = vi.fn().mockReturnValue('HE');

vi.mock('@/lib/season-planning/holidays', () => ({
  isDateInHolidays: (...args: unknown[]) => mockIsDateInHolidays(...args),
  resolveBundeslandCode: (...args: unknown[]) => mockResolveBundeslandCode(...args),
}));

// Die Ferien stammen seit dem 12.08.2026 aus der Tabelle `school_holidays`,
// nicht mehr aus einer hartkodierten Liste im Code.
vi.mock('@/lib/season-planning/holidays.server', () => ({
  loadHolidaysForState: (...args: unknown[]) => mockGetHolidaysForState(...args),
}));

const mockMarkHolidaySessions = vi.fn().mockResolvedValue(0);
vi.mock('@/lib/services/school-holidays.service', () => ({
  markHolidaySessions: (...args: unknown[]) => mockMarkHolidaySessions(...args),
}));

const mockPersistConflicts = vi.fn().mockResolvedValue(0);
const mockDetectAll = vi.fn().mockResolvedValue([]);
const mockGetCriticalConflicts = vi.fn().mockReturnValue([]);
const emptySummary = { critical: 0, warnings: 0, info: 0, total: 0 };
const mockDetectConflictsForSeason = vi
  .fn()
  .mockResolvedValue({ conflicts: [], summary: emptySummary });

vi.mock('@/lib/season-planning/conflict-detector', () => ({
  ConflictDetector: vi.fn(function (this: any) {
    this.detectAll = (...args: unknown[]) => mockDetectAll(...args);
    this.getCriticalConflicts = (...args: unknown[]) => mockGetCriticalConflicts(...args);
    this.persistConflicts = (...args: unknown[]) => mockPersistConflicts(...args);
  }),
  detectConflictsForSeason: (...args: unknown[]) => mockDetectConflictsForSeason(...args),
}));

const mockResendSend = vi.fn().mockResolvedValue({ id: 'email-001' });
vi.mock('resend', () => ({
  // Regular function (not arrow) to be constructable with `new Resend(key)`
  Resend: vi.fn(function (this: any) {
    this.emails = { send: (...args: unknown[]) => mockResendSend(...args) };
  }),
}));

const mockBuildRecipients = vi.fn().mockResolvedValue([
  {
    memberId: 'member-001',
    email: 'max@test.com',
    name: 'Max',
    groupName: 'Gruppe A',
    trainerName: 'Trainer',
    dayOfWeek: 2,
    startTime: '17:00',
    endTime: '18:30',
    firstSessionDate: '2025-05-06',
  },
]);
const mockSendConfirmationEmails = vi.fn().mockResolvedValue({ sent: 1, failed: 0, errors: [] });
vi.mock('@/lib/season-planning/season-confirmation-email.service', () => ({
  seasonConfirmationEmailService: {
    buildRecipients: (...args: unknown[]) => mockBuildRecipients(...args),
    sendConfirmationEmails: (...args: unknown[]) => mockSendConfirmationEmails(...args),
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'noreply@test.com',
  },
}));

vi.mock('@/lib/csrf', () => ({
  withCSRFProtection: vi.fn((_req: unknown, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
  // Gibt einen verbrauchten Versuch bei Fehlschlag/409 wieder frei — sonst
  // sperrt ein misslungener Publish den Admin für eine Stunde aus.
  releaseRateLimitSlot: vi.fn().mockResolvedValue(undefined),
}));

const mockAuthCtx = {
  user: { id: USER_ID, email: 'admin@test.com' },
  session: null as null,
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  } as any,
  clubId: CLUB_ID,
  role: 'admin',
  roles: ['admin'],
  memberships: [{ club_id: CLUB_ID, role: 'admin' }],
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  withAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  verifyRole: vi.fn().mockResolvedValue(true),
  forbiddenResponse: vi.fn(
    (msg: string) =>
      new Response(JSON.stringify({ error: msg }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function buildRequest(body: { acceptedWarnings?: string[] } = {}): NextRequest {
  return new NextRequest(`http://localhost:3000/api/seasons/${SEASON_ID}/planning/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedWarnings: body.acceptedWarnings ?? [] }),
  });
}

function buildDb(): any {
  const db: any = {};

  // Outside transaction: select() is used for seasons, entries, and users.
  // Uses a plain function (not wrapped in vi.fn) to avoid vitest argument-
  // serialization issues when called with Drizzle field-selection objects.
  db.select = (..._args: unknown[]) => {
    const c: any = {};
    let tableName = '';
    c.from = vi.fn((table: unknown) => {
      tableName = (table as any)?._table ?? '';
      return c;
    });
    c.where = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.then = (resolve: (v: unknown) => unknown) => {
      if (tableName === 'seasons') {
        resolve(config.season);
      } else if (tableName === 'season_plan_entries') {
        resolve(config.entries);
      } else if (tableName === 'users') {
        resolve(config.users);
      } else if (tableName === 'clubs') {
        resolve(config.club);
      } else {
        resolve([]);
      }
      return c;
    };
    return c;
  };

  // db.insert, update, delete — never used outside transaction
  db.insert = vi.fn(() => chain([]));
  db.update = vi.fn(() => chain([]));
  db.delete = vi.fn(() => chain([]));

  // transaction support
  db.transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
    if (config.failTransaction) throw config.failTransaction;

    sessionInsertCount = 0;
    const tx = createTx();
    return await callback(tx);
  });

  return db;
}

// Suppress console during tests
const origConsoleError = console.error;
const origConsoleLog = console.log;

beforeEach(() => {
  console.error = vi.fn();
  console.log = vi.fn();
  sessionInsertCount = 0;
  resetConfig();
  vi.clearAllMocks();
  mockMarkHolidaySessions.mockReset().mockResolvedValue(0);
  mockIsDateInHolidays.mockReset().mockReturnValue(false);
  mockGetHolidaysForState.mockReset().mockReturnValue([]);
  mockResolveBundeslandCode.mockReset().mockReturnValue('HE');
  mockPersistConflicts.mockReset().mockResolvedValue(0);
  mockDetectAll.mockReset().mockResolvedValue([]);
  mockGetCriticalConflicts.mockReset().mockReturnValue([]);
  mockDetectConflictsForSeason
    .mockReset()
    .mockResolvedValue({ conflicts: [], summary: emptySummary });
  mockResendSend.mockReset().mockResolvedValue({ id: 'email-001' });
  mockBuildRecipients.mockReset().mockResolvedValue([
    {
      memberId: 'member-001',
      email: 'max@test.com',
      name: 'Max',
      groupName: 'Gruppe A',
      trainerName: 'Trainer',
      dayOfWeek: 2,
      startTime: '17:00',
      endTime: '18:30',
      firstSessionDate: '2025-05-06',
    },
  ]);
  mockSendConfirmationEmails.mockReset().mockResolvedValue({ sent: 1, failed: 0, errors: [] });
});

afterEach(() => {
  console.error = origConsoleError;
  console.log = origConsoleLog;
});

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/seasons/[id]/planning/confirm', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/seasons/[id]/planning/confirm/route');
    POST = mod.POST;
  }, 30_000);

  function ctx(id: string = SEASON_ID) {
    return { params: Promise.resolve({ id }) };
  }

  // ──────────────────────────────────────────────────────────
  // SUCCESS PATH
  // ──────────────────────────────────────────────────────────

  describe('success path', () => {
    beforeEach(() => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());
    });

    it('publishes sessions, updates plan entries, season status, conflicts, audit trail', async () => {
      const res = await POST(buildRequest(), ctx());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBe(16);
      expect(body.publishedSessionIds).toHaveLength(16);
    });

    // Regression: Das Veröffentlichen legte früher nur Sessions an, aber keine
    // Buchungen. Mitglieder-Dashboard, Trainer-Teilnehmerliste und
    // Anwesenheitserfassung lesen alle aus `bookings` und blieben deshalb leer,
    // während die Abrechnung aus derselben Zuteilung bereits Rechnungen erzeugte.
    it('legt für jeden zugeteilten Teilnehmer je Session eine Buchung an', async () => {
      const res = await POST(buildRequest(), ctx());

      expect(res.status).toBe(200);
      const body = await res.json();
      // 16 Sessions × 2 zugeteilte Mitglieder
      expect(body.bookingsCreated).toBe(32);
    });

    it('legt ohne zugewiesenen Platz keine Buchungen an (bookings.court_id ist NOT NULL)', async () => {
      resetConfig({
        entries: [{ ...DEFAULT_ENTRY, court_id: null }],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.publishedSessions).toBe(16);
      expect(body.bookingsCreated).toBe(0);
    });

    it('creates new schedule when none exists', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [], // triggers schedule insert
        newScheduleId: 'schedule-new-abc',
      });

      // Rebuild mockGetDb because config changed
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    // Ein Eintrag mit status='published' wurde früher übersprungen — damit war
    // ein einmal veröffentlichter Plan für immer eingefroren. Jetzt wird er
    // mitveröffentlicht.
    it('veröffentlicht auch bereits veröffentlichte Einträge erneut', async () => {
      resetConfig({
        entries: [
          { ...DEFAULT_ENTRY, id: 'entry-001', status: 'published' },
          { ...DEFAULT_ENTRY, id: 'entry-002', status: 'draft', expected_participants: [] },
        ],
        schedule: [DEFAULT_SCHEDULE],
        sessions: Array.from({ length: 32 }, (_, i) => ({ id: `session-w${i + 1}` })),
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      // Beide Einträge × 16 Wochen
      expect(body.publishedSessions).toBe(32);
    });

    // Erneutes Veröffentlichen einer laufenden Saison: künftige Sessions werden
    // verworfen und neu erzeugt, vergangene bleiben unangetastet.
    it('ersetzt bei einer veröffentlichten Saison die künftigen Sessions', async () => {
      const iso = (offsetDays: number) =>
        new Date(Date.now() + offsetDays * 86400000).toISOString().substring(0, 10);
      resetConfig({
        season: [
          {
            ...DEFAULT_SEASON,
            planning_status: 'published',
            // Re-Publish wird seit dem Saison-Refactor über `published_at`
            // erkannt, nicht über den Status (ein Re-Plan setzt den Status
            // auf 'manual_review' zurück).
            published_at: new Date().toISOString(),
            start_date: iso(7),
            end_date: iso(7 + 16 * 7),
          },
        ],
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        staleSessions: [{ id: 'old-session-1' }, { id: 'old-session-2' }],
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.republish).toBe(true);
      expect(body.removedSessions).toBe(2);
      expect(body.publishedSessions).toBe(16);
    });

    it('rejects with a clear 400 when there are no plan entries', async () => {
      resetConfig({ entries: [], schedule: [] });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Keine Planeinträge vorhanden');
    });
  });

  // ──────────────────────────────────────────────────────────
  // TRANSACTION ROLLBACK
  // ──────────────────────────────────────────────────────────

  describe('transaction rollback', () => {
    /**
     * Bis zum 12.08.2026 reichte die Route `err.message` unverändert an den Client
     * durch — im Fehlerfall das komplette Insert-Statement samt aller Parameter
     * (~80.000 Zeichen inklusive Mitglieds-UUIDs) mitten in der Oberfläche.
     * Geprüft wird deshalb beides: verständliche Meldung, keine DB-Interna.
     */
    function expectGenericError(message: string) {
      expect(message).toContain('konnte nicht veröffentlicht werden');
      expect(message).not.toMatch(/insert into|constraint|planning_conflicts|failed/i);
    }

    it('rolls back sessions if audit trail insert fails', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        failAuditTrail: new Error('Constraint violation: season_planning_history'),
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expectGenericError(body.error);
    });

    it('rolls back sessions if season status update fails', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        failSeasonUpdate: new Error('Check constraint: planning_status'),
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expectGenericError(body.error);
    });

    it('rolls back sessions if conflict persistence fails', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());
      mockPersistConflicts.mockRejectedValueOnce(
        new Error('DB error: planning_conflicts insert failed')
      );

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expectGenericError(body.error);
    });

    it('rolls back sessions if a mid-way session insert fails', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        failSessionAtWeek: 5, // fails at week 5 (0-indexed), after 5 successful inserts
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expectGenericError(body.error);
    });

    it('rolls back if schedule insert fails (no existing schedule)', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [],
        failScheduleInsert: new Error('Schedule insert failed'),
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expectGenericError(body.error);
    });
  });

  // ──────────────────────────────────────────────────────────
  // POST-TRANSACTION & HOLIDAY CHECKING
  // ──────────────────────────────────────────────────────────

  describe('post-transaction behavior', () => {
    it('publish succeeds even if holiday data cannot be loaded (club query fails)', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        // Empty club → triggers fallback to empty holidays
        club: [],
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      // Publish itself succeeded — holiday resolution is non-critical
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBe(16);

      // resolveBundeslandCode was NOT called because club query returned empty
      expect(mockResolveBundeslandCode).not.toHaveBeenCalled();
    });

    it('does not skip sessions when club has no bundesland set', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        club: [{ bundesland: null }],
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // No bundesland → no holidays → all 16 weeks published
      expect(body.publishedSessions).toBe(16);
      expect(mockGetHolidaysForState).not.toHaveBeenCalled();
    });

    it('sends email notifications when RESEND_API_KEY is set and members exist', async () => {
      resetConfig({
        entries: [{ ...DEFAULT_ENTRY, expected_participants: ['member-001'] }],
        schedule: [DEFAULT_SCHEDULE],
        users: [{ id: 'member-001', email: 'max@test.com', full_name: 'Max' }],
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notificationsSent).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────
  // AUTH AND VALIDATION
  // ──────────────────────────────────────────────────────────

  describe('auth and validation', () => {
    beforeEach(() => {
      mockGetDb = vi.fn(() => buildDb());
    });

    it('returns 404 when season not found', async () => {
      resetConfig({ season: [], entries: [] });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx('nonexistent'));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('not found');
    });

    it('returns 409 when critical conflicts are unresolved', async () => {
      resetConfig({ entries: [DEFAULT_ENTRY] });
      mockGetDb = vi.fn(() => buildDb());

      const criticalConflict = {
        id: 'conflict_critical_001',
        type: 'trainer_double_booking',
        severity: 'critical',
        description: 'Trainer-Doppelbelegung',
        suggestedResolution: 'Anderen Trainer zuweisen',
        affectedEntities: {
          trainerIds: [TRAINER_ID],
          memberIds: ['member-001'],
          courtIds: [],
          groupIds: ['group-001'],
          planEntryIds: [],
        },
        timeSlot: { dayOfWeek: 2, startTime: '17:00', endTime: '18:30' },
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
        resolutionNotes: null,
      };

      mockDetectConflictsForSeason.mockResolvedValueOnce({
        conflicts: [criticalConflict],
        summary: { critical: 1, warnings: 0, info: 0, total: 1 },
      });

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('Kritische Konflikte');
      expect(body.unresolvedCriticalConflicts).toHaveLength(1);
    });

    // Die Freigabe hängt jetzt an der persistierten Entscheidung des Admins
    // (PATCH /planning/conflicts → status resolved/ignored), nicht mehr an einer
    // vom Client mitgeschickten ID-Liste.
    it('allows publish when the critical conflict is marked resolved', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());

      const criticalConflict = {
        id: 'conflict_critical_001',
        type: 'trainer_double_booking',
        severity: 'critical',
        description: 'Trainer-Doppelbelegung',
        suggestedResolution: 'Anderen Trainer zuweisen',
        affectedEntities: {
          trainerIds: [TRAINER_ID],
          memberIds: [],
          courtIds: [],
          groupIds: [],
          planEntryIds: [],
        },
        timeSlot: { dayOfWeek: 2, startTime: '17:00', endTime: '18:30' },
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'admin-001',
        resolutionNotes: 'Manuell gelöst',
      };

      mockDetectConflictsForSeason.mockResolvedValueOnce({
        conflicts: [criticalConflict],
        summary: { critical: 0, warnings: 0, info: 0, total: 0 },
      });

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // NaN-SAFE DATE HANDLING
  // ──────────────────────────────────────────────────────────
  // The confirm route must not crash with "Invalid time value" when
  // season.year, start_date, or end_date are NaN/missing/broken.
  // These tests exercise the fallback paths added in the NaN-safe fix.
  // ──────────────────────────────────────────────────────────

  describe('NaN-safe date handling', () => {
    it('publishes successfully when season.year is NaN (falls back to current year)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, year: NaN }],
        entries: [DEFAULT_ENTRY],
        schedule: [], // triggers schedule insert with fallback year
        newScheduleId: 'schedule-nan-year',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.year is null/undefined', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, year: null }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-null-year',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.start_date is null (defaults to now)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, start_date: null, end_date: null }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-no-start',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.start_date is an invalid string (NaN fallback)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, start_date: 'not-a-valid-date!!', end_date: null }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-bad-start',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.end_date is null (defaults to now + 90 days)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, end_date: null }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-no-end',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.end_date is an invalid string (NaN fallback)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, end_date: 'garbage-date-string' }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-bad-end',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when ALL date fields are broken simultaneously', async () => {
      resetConfig({
        season: [
          {
            ...DEFAULT_SEASON,
            year: NaN,
            start_date: null,
            end_date: 'not-a-valid-date',
          },
        ],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-all-broken',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // With default dates (now → now+90d), entries with 16 weeks produce
      // ~13 sessions (13 weeks × 1 entry). The key assertion is no 500 crash.
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully when season.year is a string (e.g. stored as varchar)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, year: '2025' as any }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-string-year',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('publishes successfully with NaN year AND existing schedule (find path, not insert)', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, year: NaN }],
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE], // existing schedule — exercises the find-branch
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBeGreaterThan(0);
    });

    it('does NOT crash with "Invalid time value" when start_date produces NaN', async () => {
      resetConfig({
        season: [{ ...DEFAULT_SEASON, start_date: 'definitely-not-a-date', end_date: null }],
        entries: [DEFAULT_ENTRY],
        schedule: [],
        newScheduleId: 'schedule-invalid-time',
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      const body = await res.json();

      // Must not return a 500 "Invalid time value" error
      if (res.status === 500) {
        expect(body.error).not.toContain('Invalid time value');
      }
      // Should succeed gracefully
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // INLINE HOLIDAY CHECKING (in session creation loop)
  // ──────────────────────────────────────────────────────────

  describe('inline holiday checking', () => {
    it('skips sessions that fall on school holidays during creation', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
        club: [{ bundesland: 'Hessen' }],
      });
      mockGetDb = vi.fn(() => buildDb());
      // Simulate Hessen Sommerferien — isDateInHolidays returns true for
      // weeks 10–15 (July 7 – Aug 15), skipping 6 of 16 weeks
      mockIsDateInHolidays.mockImplementation((_date: unknown) => {
        // The mock receives an ISO date string like "2025-07-07"
        return true; // ALL sessions are considered on holiday
      });
      mockResolveBundeslandCode.mockReturnValue('HE');
      mockGetHolidaysForState.mockResolvedValue([
        { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
      ]);

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // All 16 weeks are holidays → 0 sessions published
      expect(body.publishedSessions).toBe(0);
      expect(mockIsDateInHolidays).toHaveBeenCalled();
    });
  });
});
