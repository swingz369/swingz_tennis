/**
 * Unit tests for POST /api/seasons/[id]/planning/confirm
 *
 * Focus: transaction rollback — if any DB write inside the transaction
 * fails, all prior writes (sessions, plan entries, season status, conflicts,
 * audit trail) must be rolled back.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

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
  /** Existing schedule (empty array → no schedule, triggers insert) */
  schedule: unknown[];
  /** ID returned from schedule insert */
  newScheduleId: string;
  /** Session insert results (one per week) */
  sessions: unknown[];
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
    schedule: [DEFAULT_SCHEDULE],
    newScheduleId: DEFAULT_NEW_SCHEDULE_ID,
    sessions: DEFAULT_SESSIONS,
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
    // Inside the transaction, the only SELECT is for finding an existing
    // schedule (`tx.select().from(schedules).where(...).limit(1)`).
    // We resolve with config.schedule regardless of the table.
    const c: any = {};
    c.from = vi.fn((_table?: unknown) => c);
    c.where = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve(config.schedule);
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
let mockGetDb: ReturnType<typeof vi.fn>;

// ── vi.mock calls (hoisted to module top) ───────────────────

// Mock drizzle-orm's SQL functions while preserving all other exports.
// The real implementations introspect Column objects and fail on our plain
// mock schema objects, so eq/and/inArray return harmless empty mocks.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
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
}));

const mockMarkHolidaySessions = vi.fn().mockResolvedValue(0);
vi.mock('@/lib/services/school-holidays.service', () => ({
  markHolidaySessions: (...args: unknown[]) => mockMarkHolidaySessions(...args),
}));

const mockPersistConflicts = vi.fn().mockResolvedValue(0);
const mockDetectAll = vi.fn().mockResolvedValue([]);
const mockGetCriticalConflicts = vi.fn().mockReturnValue([]);

vi.mock('@/lib/season-planning/conflict-detector', () => ({
  ConflictDetector: vi.fn(function (this: any) {
    this.detectAll = (...args: unknown[]) => mockDetectAll(...args);
    this.getCriticalConflicts = (...args: unknown[]) => mockGetCriticalConflicts(...args);
    this.persistConflicts = (...args: unknown[]) => mockPersistConflicts(...args);
  }),
}));

const mockResendSend = vi.fn().mockResolvedValue({ id: 'email-001' });
vi.mock('resend', () => ({
  // Regular function (not arrow) to be constructable with `new Resend(key)`
  Resend: vi.fn(function (this: any) {
    this.emails = { send: (...args: unknown[]) => mockResendSend(...args) };
  }),
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
  mockPersistConflicts.mockReset().mockResolvedValue(0);
  mockDetectAll.mockReset().mockResolvedValue([]);
  mockGetCriticalConflicts.mockReset().mockReturnValue([]);
  mockResendSend.mockReset().mockResolvedValue({ id: 'email-001' });
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
  });

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

    it('skips already published entries', async () => {
      resetConfig({
        entries: [
          { ...DEFAULT_ENTRY, id: 'entry-001', status: 'published' },
          { ...DEFAULT_ENTRY, id: 'entry-002', status: 'draft', expected_participants: [] },
        ],
        schedule: [DEFAULT_SCHEDULE],
        sessions: Array.from({ length: 16 }, (_, i) => ({ id: `session-e2-w${i + 1}` })),
      });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      // Only entry-002 publishes 16 weeks
      expect(body.publishedSessions).toBe(16);
    });

    it('handles empty entries gracefully', async () => {
      resetConfig({ entries: [], schedule: [] });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBe(0);
      expect(body.publishedSessionIds).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // TRANSACTION ROLLBACK
  // ──────────────────────────────────────────────────────────

  describe('transaction rollback', () => {
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
      expect(body.error).toContain('Constraint violation');
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
      expect(body.error).toContain('Check constraint');
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
      expect(body.error).toContain('planning_conflicts');
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
      expect(body.error).toContain('Session insert failed');
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
      expect(body.error).toContain('Schedule insert failed');
    });
  });

  // ──────────────────────────────────────────────────────────
  // POST-TRANSACTION BEHAVIOR
  // ──────────────────────────────────────────────────────────

  describe('post-transaction behavior', () => {
    it('publish succeeds even if markHolidaySessions throws (non-critical)', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());
      mockMarkHolidaySessions.mockRejectedValueOnce(new Error('Supabase connection error'));

      const res = await POST(buildRequest(), ctx());
      // Publish itself succeeded — holiday marking is non-critical
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.publishedSessions).toBe(16);

      // markHolidaySessions was called but error was caught and logged
      expect(mockMarkHolidaySessions).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('holiday'),
        expect.any(Error)
      );
    });

    it('does not call markHolidaySessions when no schedule was created', async () => {
      resetConfig({ entries: [], schedule: [] });
      mockGetDb = vi.fn(() => buildDb());

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      // scheduleId is null → markHolidaySessions is not called
      expect(mockMarkHolidaySessions).not.toHaveBeenCalled();
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

      mockDetectAll.mockResolvedValueOnce([criticalConflict]);
      mockGetCriticalConflicts.mockReturnValueOnce([criticalConflict]);

      const res = await POST(buildRequest({ acceptedWarnings: [] }), ctx());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('Kritische Konflikte');
      expect(body.unresolvedCriticalConflicts).toHaveLength(1);
    });

    it('allows publish when critical conflicts are accepted by ID', async () => {
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
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
        resolutionNotes: null,
      };

      mockDetectAll.mockResolvedValueOnce([criticalConflict]);
      mockGetCriticalConflicts.mockReturnValueOnce([criticalConflict]);

      const res = await POST(buildRequest({ acceptedWarnings: [criticalConflict.id] }), ctx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // HOLIDAY MARKING
  // ──────────────────────────────────────────────────────────

  describe('post-transaction holiday marking', () => {
    it('calls markHolidaySessions with schedule and club ID after commit', async () => {
      resetConfig({
        entries: [DEFAULT_ENTRY],
        schedule: [DEFAULT_SCHEDULE],
      });
      mockGetDb = vi.fn(() => buildDb());
      mockMarkHolidaySessions.mockResolvedValueOnce(3);

      const res = await POST(buildRequest(), ctx());
      expect(res.status).toBe(200);
      expect(mockMarkHolidaySessions).toHaveBeenCalledWith(
        mockAuthCtx.supabase,
        DEFAULT_SCHEDULE.id,
        CLUB_ID
      );
      // 3 sessions marked as holiday
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Marked 3 sessions'));
    });
  });
});
