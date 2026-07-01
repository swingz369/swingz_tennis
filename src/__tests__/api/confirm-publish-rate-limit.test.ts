/**
 * Unit tests: 3/h Rate Limit on POST /api/seasons/[id]/planning/confirm
 *
 * Verifies that the confirm endpoint enforces max 3 requests per hour
 * (returns 429 on the 4th request within the window).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ════════════════════════════════════════════════════════════
// SHARED MOCK REFERENCE — used by vi.mock (hoisted) AND tests
// ════════════════════════════════════════════════════════════

const mockCheckRateLimitOrFail = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: mockCheckRateLimitOrFail,
}));

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const SEASON_ID = 'season-rl-001';
const CLUB_ID = 'club-001';
const USER_ID = 'user-admin-001';

// ════════════════════════════════════════════════════════════
// CHAINABLE QUERY BUILDER
// ════════════════════════════════════════════════════════════

function chain(result: unknown): any {
  const c: any = {};
  for (const key of ['from', 'where', 'limit', 'set', 'values', 'returning', 'order']) {
    c[key] = vi.fn(() => c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    if (result instanceof Error) reject(result);
    else resolve(result);
    return c;
  };
  return c;
}

function createDummyTx(): any {
  const tx: any = {};
  tx.select = () => {
    const c: any = {};
    c.from = () => c;
    c.where = () => c;
    c.limit = () => c;
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve([]);
      return c;
    };
    return c;
  };
  tx.insert = () => {
    const c: any = {};
    c.values = () => c;
    c.returning = () => c;
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve([{ id: 'sid' }]);
      return c;
    };
    return c;
  };
  tx.update = () => {
    const c: any = {};
    c.set = () => c;
    c.where = () => c;
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve([]);
      return c;
    };
    return c;
  };
  tx.delete = () => chain([]);
  return tx;
}

const mockDb = {
  select: () => {
    const c: any = {};
    c.from = () => c;
    c.where = () => c;
    c.limit = () => c;
    c.then = (resolve: (v: unknown) => unknown) => {
      resolve([
        {
          id: SEASON_ID,
          club_id: CLUB_ID,
          name: 'Test',
          year: 2025,
          start_date: '2025-05-01',
          end_date: '2025-08-31',
          planning_status: 'collecting_preferences',
        },
      ]);
      return c;
    };
    return c;
  },
  insert: () => chain([]),
  update: () => chain([]),
  delete: () => chain([]),
  transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(createDummyTx())),
};

vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: mockDb,
}));

vi.mock('@/src/infrastructure/persistence/schema', () => ({
  seasons: { _table: 'seasons' },
  seasonPlanEntries: { _table: 'season_plan_entries' },
  sessions: { _table: 'sessions' },
  schedules: { _table: 'schedules' },
  seasonPlanningHistory: { _table: 'season_planning_history' },
  users: {
    _table: 'users',
    id: { name: 'id' },
    email: { name: 'email' },
    full_name: { name: 'full_name' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    inArray: vi.fn(() => ({})),
  };
});

vi.mock('@/lib/season-planning/conflict-detector', () => ({
  ConflictDetector: vi.fn(function (this: any) {
    this.detectAll = vi.fn().mockResolvedValue([]);
    this.getCriticalConflicts = vi.fn().mockReturnValue([]);
    this.persistConflicts = vi.fn().mockResolvedValue(0);
  }),
}));

vi.mock('@/lib/services/school-holidays.service', () => ({
  markHolidaySessions: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/env', () => ({
  env: { RESEND_API_KEY: undefined, EMAIL_FROM: undefined },
}));

vi.mock('@/lib/csrf', () => ({
  withCSRFProtection: vi.fn((_req: unknown, fn: () => Promise<Response>) => fn()),
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

function buildRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/seasons/${SEASON_ID}/planning/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedWarnings: [] }),
  });
}

function ctx(id: string = SEASON_ID) {
  return { params: Promise.resolve({ id }) };
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/seasons/[id]/planning/confirm — 3/h Rate Limit', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let mockedRateLimit: any;

  beforeAll(async () => {
    const mod = await import('@/app/api/seasons/[id]/planning/confirm/route');
    POST = mod.POST;
    // Use the already-mocked checkRateLimitOrFail (defined at top of file)
    mockedRateLimit = mockCheckRateLimitOrFail;
  });

  beforeEach(() => {
    mockedRateLimit.mockReset();
    mockedRateLimit.mockResolvedValue(null); // default: no rate limit
    mockDb.transaction = vi.fn(async (cb: (tx: any) => Promise<any>) => cb(createDummyTx()));
  });

  describe('rate limit enforcement', () => {
    it('returns 429 on the 4th request within the 1-hour window', async () => {
      mockedRateLimit
        .mockResolvedValueOnce(null) // call 1 → ok
        .mockResolvedValueOnce(null) // call 2 → ok
        .mockResolvedValueOnce(null) // call 3 → ok
        .mockResolvedValueOnce(
          // call 4 → rate limited
          NextResponse.json({ error: 'Rate limit exceeded', retryAfter: 3600 }, { status: 429 })
        );

      // Requests 1-3 should NOT be rate-limited
      for (let i = 0; i < 3; i++) {
        const res = await POST(buildRequest(), ctx());
        expect(res.status).not.toBe(429);
      }

      // Request 4 MUST be rate-limited (429)
      const rateLimited = await POST(buildRequest(), ctx());
      expect(rateLimited.status).toBe(429);
    });

    it('allows requests after the window resets', async () => {
      mockedRateLimit
        .mockResolvedValueOnce(null) // call 1 → ok
        .mockResolvedValueOnce(null) // call 2 → ok
        .mockResolvedValueOnce(null) // call 3 → ok
        .mockResolvedValueOnce(
          // call 4 → rate limited
          NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
        )
        .mockResolvedValueOnce(null); // call 5 → reset: ok again

      // Burn 3 requests
      for (let i = 0; i < 3; i++) {
        await POST(buildRequest(), ctx());
      }
      // 4th is rate-limited
      const limited = await POST(buildRequest(), ctx());
      expect(limited.status).toBe(429);

      // 5th after window "reset" — should succeed
      const afterReset = await POST(buildRequest(), ctx());
      expect(afterReset.status).not.toBe(429);
    });
  });

  describe('correct rate limit config', () => {
    it('calls checkRateLimitOrFail with { max: 3, windowMs: 3_600_000 }', async () => {
      mockedRateLimit.mockClear();
      mockedRateLimit.mockResolvedValue(null);

      await POST(buildRequest(), ctx());

      expect(mockedRateLimit).toHaveBeenCalledTimes(1);
      const [requestArg, configArg] = mockedRateLimit.mock.calls[0];
      expect(requestArg).toBeInstanceOf(NextRequest);
      expect(configArg).toEqual({ max: 3, windowMs: 3_600_000 });
    });
  });
});
