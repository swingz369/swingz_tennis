/**
 * Unit tests for GET /api/clubs
 *
 * Tests pagination params, role-based filtering (superadmin vs member),
 * member count aggregation, and error handling.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { parseClubsResponse, type Club } from '@/lib/clubs';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const CLUB_ID = 'club-001';
const USER_ID = 'user-001';

// ════════════════════════════════════════════════════════════
// MOCK STATE
// ════════════════════════════════════════════════════════════

let mockVerifyRole: any;
const mockSupabase = { from: vi.fn() };

const mockAuthCtx = {
  user: { id: USER_ID, email: 'admin@test.com' },
  role: 'admin',
  clubId: CLUB_ID,
  memberships: [{ club_id: CLUB_ID }],
};

// ── Module mocks ────────────────────────────────────────────

vi.mock('@/infrastructure/external/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  verifyRole: (...args: unknown[]) => mockVerifyRole(...args),
  forbiddenResponse: (msg?: string) =>
    new Response(JSON.stringify({ error: msg || 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STANDARD: { max: 20, windowMs: 60000 } },
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Creates a thenable chain mock that supports select → eq → in → order → range.
 * When range() is called, returns { data, error } as a plain object.
 * When the chain is awaited without range(), resolves with { count } (for count queries).
 */
function makeChain(opts: {
  data?: unknown[] | null;
  count?: number | null;
  error?: { message: string } | null;
  /** If true, range() is never called — chain resolves via .then() with { count } */
}) {
  const { data = [], count = 0, error = null } = opts;
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => ({ data, error }));
  // Thenable — used when chain is passed to Promise.all without calling range()
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ data, count, error });
    return chain;
  };
  return chain;
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('GET /api/clubs', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/clubs/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    mockSupabase.from.mockReset();
    // Reset to admin role by default
    mockAuthCtx.role = 'admin';
    mockAuthCtx.memberships = [{ club_id: CLUB_ID }];
  });

  // ── Pagination ──────────────────────────────────────────

  it('returns paginated clubs with pagination metadata and correct .range() offset', async () => {
    const clubs = [
      { id: 'c1', name: 'TC Alpha', status: 'active', max_members: 100, created_at: '2026-01-01' },
      { id: 'c2', name: 'TC Beta', status: 'active', max_members: 200, created_at: '2026-01-02' },
    ];

    const clubsDataChain = makeChain({ data: clubs, count: 15 });
    const membershipsChain = makeChain({
      data: [{ club_id: 'c1' }, { club_id: 'c1' }, { club_id: 'c2' }],
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsDataChain;
      if (table === 'user_club_memberships') return membershipsChain;
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs?page=1&limit=2');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify .range() was called with correct offset
    expect(clubsDataChain.range).toHaveBeenCalledWith(0, 1);

    // Response shape
    expect(body.clubs).toHaveLength(2);
    expect(body.clubs[0]).toEqual({
      id: 'c1',
      name: 'TC Alpha',
      status: 'active',
      memberCount: 2,
      maxMembers: 100,
      createdAt: '2026-01-01',
    });
    expect(body.clubs[1]).toEqual({
      id: 'c2',
      name: 'TC Beta',
      status: 'active',
      memberCount: 1,
      maxMembers: 200,
      createdAt: '2026-01-02',
    });

    // Pagination metadata
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.totalCount).toBe(15);
    expect(body.pagination.totalPages).toBe(8);
    expect(body.pagination.hasNext).toBe(true);
    expect(body.pagination.hasPrev).toBe(false);
  });

  // Seitengrösse 25 seit 18.08.2026 (vorher 20): identisch zum Default in
  // lib/pagination.ts, damit Vereinsliste und übrige Tabellen gleich blättern.
  it('uses default page=1 and limit=25 when no params provided', async () => {
    const clubsChain = makeChain({ data: [], count: 0 });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsChain;
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(25);
    // Default offset=0, limit=25 → range(0, 24)
    expect(clubsChain.range).toHaveBeenCalledWith(0, 24);
  });

  it('calculates correct offset for page 3 with limit 10', async () => {
    const clubsChain = makeChain({ data: [], count: 25 });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsChain;
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs?page=3&limit=10');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.page).toBe(3);
    expect(body.pagination.offset).toBe(20);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrev).toBe(true);
    // offset=20, limit=10 → range(20, 29)
    expect(clubsChain.range).toHaveBeenCalledWith(20, 29);
  });

  // Die Obergrenze liegt seit 18.08.2026 bei ALL_LIMIT statt bei 100: die
  // Vereinsübersicht bietet „Alle" als Seitengrösse an, und mit einer Kappung
  // bei 100 hätte diese Option stillschweigend gelogen.
  it('clamps limit to ALL_LIMIT and min 1', async () => {
    const clubsChain500 = makeChain({ data: [], count: 0 });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsChain500;
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs?limit=500');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.limit).toBe(500);
    expect(clubsChain500.range).toHaveBeenCalledWith(0, 499);
  });

  it('treats limit=0 as default (JavaScript falsy → || fallback)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return makeChain({ data: [], count: 0 });
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs?limit=0');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    // parseInt('0') is falsy → || DEFAULT_CLUB_LIMIT kicks in → limit=25
    expect(body.pagination.limit).toBe(25);
  });

  // ── Suche und Statusfilter (18.08.2026) ─────────────────

  it('passes an escaped ILIKE pattern for `search` to data and count query', async () => {
    const clubsChain = makeChain({ data: [], count: 0 });
    const countChain = makeChain({ count: 0, countOnly: true });
    let call = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return call++ === 0 ? clubsChain : countChain;
      return makeChain({});
    });

    // `%` im Suchbegriff ist in ILIKE ein Platzhalter — ohne Maskierung fände
    // die Suche nach „TC%Rot" auch alles dazwischen.
    const req = new NextRequest('http://localhost/api/clubs?search=TC%25Rot');
    await GET(req);

    expect(clubsChain.ilike).toHaveBeenCalledWith('name', '%TC\\%Rot%');
    expect(countChain.ilike).toHaveBeenCalledWith('name', '%TC\\%Rot%');
  });

  it('filters by status when given, and not when status=all', async () => {
    const withStatus = makeChain({ data: [], count: 0 });
    mockSupabase.from.mockImplementation((table: string) =>
      table === 'clubs' ? withStatus : makeChain({})
    );
    await GET(new NextRequest('http://localhost/api/clubs?status=pending'));
    expect(withStatus.eq).toHaveBeenCalledWith('status', 'pending');

    const allStatus = makeChain({ data: [], count: 0 });
    mockSupabase.from.mockImplementation((table: string) =>
      table === 'clubs' ? allStatus : makeChain({})
    );
    await GET(new NextRequest('http://localhost/api/clubs?status=all'));
    expect(allStatus.eq).not.toHaveBeenCalledWith('status', expect.anything());
  });

  // ── Role-based filtering ────────────────────────────────

  it('filters clubs by membership for non-superadmin (.in() called)', async () => {
    mockAuthCtx.role = 'admin';
    mockAuthCtx.memberships = [{ club_id: 'club-abc' }];

    const clubsChain = makeChain({ data: [], count: 0 });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsChain;
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    await GET(req);

    // Verify .in('id', ['club-abc']) was called on the clubs query
    expect(clubsChain.in).toHaveBeenCalledWith('id', ['club-abc']);
  });

  // Tenant isolation: a superadmin manages SEVERAL clubs, not ALL of them —
  // seeing every club on the platform is the `owner` role. So the membership
  // filter MUST be applied for a superadmin too.
  it('scopes clubs for superadmin to their own memberships (.in() filter applied)', async () => {
    mockAuthCtx.role = 'superadmin';
    mockAuthCtx.memberships = [{ club_id: 'c1' }, { club_id: 'c2' }];

    const clubs = [
      { id: 'c1', name: 'TC Alpha', status: 'active', max_members: 100 },
      { id: 'c2', name: 'TC Beta', status: 'active', max_members: 200 },
    ];

    const clubsChain = makeChain({ data: clubs, count: 2 });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return clubsChain;
      if (table === 'user_club_memberships')
        return makeChain({ data: [{ club_id: 'c1' }, { club_id: 'c2' }] });
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clubs).toHaveLength(2);
    // The third club (c3) must never be reachable — .in() carries exactly the
    // superadmin's own club ids.
    expect(clubsChain.in).toHaveBeenCalledWith('id', ['c1', 'c2']);
  });

  // ── Member counts ───────────────────────────────────────

  it('returns 0 memberCount when no memberships exist', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') {
        return makeChain({
          data: [{ id: 'c1', name: 'Empty Club', status: 'active', max_members: 50 }],
          count: 1,
        });
      }
      if (table === 'user_club_memberships') return makeChain({ data: [] });
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clubs[0].memberCount).toBe(0);
  });

  // ── Edge cases ──────────────────────────────────────────

  it('returns empty clubs array when no clubs exist', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return makeChain({ data: [], count: 0 });
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clubs).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
    expect(body.pagination.totalPages).toBe(1);
  });

  it('defaults status to "active" and maxMembers to 100 when null', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') {
        return makeChain({
          data: [{ id: 'c1', name: 'TC Null', status: null, max_members: null }],
          count: 1,
        });
      }
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clubs[0].status).toBe('active');
    expect(body.clubs[0].maxMembers).toBe(100);
  });

  // ── Error handling ──────────────────────────────────────

  it('returns 500 on Supabase error', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clubs') return makeChain({ error: { message: 'connection refused' } });
      return makeChain({});
    });

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Vereine konnten nicht geladen werden');
  });

  it('returns 403 when verifyRole fails', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost/api/clubs');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// parseClubsResponse — unit tests for the shared helper
// ════════════════════════════════════════════════════════════

describe('parseClubsResponse', () => {
  const sampleClubs: Club[] = [
    { id: 'c1', name: 'Alpha', status: 'active', maxMembers: 100, memberCount: 5 },
    { id: 'c2', name: 'Beta', status: 'active', maxMembers: 200, memberCount: 10 },
  ];

  it('extracts clubs from the new paginated response shape', () => {
    const data = { clubs: sampleClubs, pagination: { page: 1, totalPages: 1 } };
    expect(parseClubsResponse(data)).toEqual(sampleClubs);
  });

  it('returns a flat array directly (backward-compat)', () => {
    expect(parseClubsResponse(sampleClubs)).toEqual(sampleClubs);
  });

  it('returns empty array for null input', () => {
    expect(parseClubsResponse(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseClubsResponse(undefined)).toEqual([]);
  });

  it('returns empty array for a plain object without clubs key', () => {
    expect(parseClubsResponse({ pagination: {} })).toEqual([]);
  });

  it('returns empty array for a string input', () => {
    expect(parseClubsResponse('unexpected')).toEqual([]);
  });

  it('returns empty array when clubs key is not an array', () => {
    expect(parseClubsResponse({ clubs: 'not-an-array' })).toEqual([]);
  });

  it('returns empty array when paginated response has empty clubs', () => {
    expect(parseClubsResponse({ clubs: [], pagination: {} })).toEqual([]);
  });
});
