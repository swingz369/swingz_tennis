import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Supabase server client ──────────────────────────────
// We build a chainable mock that API routes call via createClient()

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function createMockQueryBuilder(overrides: Partial<MockQueryBuilder> = {}): MockQueryBuilder {
  const self: MockQueryBuilder = {
    select: vi.fn(() => self),
    insert: vi.fn(() => self),
    update: vi.fn(() => self),
    delete: vi.fn(() => self),
    upsert: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    gte: vi.fn(() => self),
    order: vi.fn(() => self),
    limit: vi.fn(() => self),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    ...overrides,
  };
  return self;
}

function createMockSupabase(fromImpl: (table: string) => MockQueryBuilder) {
  return {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn((table: string) => fromImpl(table)),
  };
}

// ── Mock modules ──────────────────────────────────────────────
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

// requireAuthApi is used by gamification (and shop/coupons) routes.
// It creates its own Supabase client internally via cookies + @supabase/ssr,
// so we mock it here to feed controlled auth state to those routes.
const mockRequireAuthApi = vi.fn();
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual('@/lib/auth');
  return {
    ...(actual as Record<string, unknown>),
    requireAuthApi: () => mockRequireAuthApi(),
  };
});

// Suppress console.error during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  mockCreateClient.mockReset();
  mockCreateAdminClient.mockReset();
  mockRequireAuthApi.mockReset();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// ── Helper ───────────────────────────────────────────────────
function buildRequest(method: string, body?: unknown, url = 'http://localhost:3000'): NextRequest {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>) = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), init);
}

// ════════════════════════════════════════════════════════════
// 1.  POST /api/public/register
// ════════════════════════════════════════════════════════════
describe('POST /api/public/register', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/public/register/route');
    POST = mod.POST;
  });

  it('returns 400 when firstName is missing', async () => {
    const res = await POST(buildRequest('POST', { lastName: 'Doe', email: 'test@test.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Vorname');
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(buildRequest('POST', { firstName: 'John', lastName: 'Doe' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email (no @)', async () => {
    const res = await POST(
      buildRequest('POST', { firstName: 'John', lastName: 'Doe', email: 'invalid' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('E-Mail');
  });

  it('returns 409 when a pending registration already exists', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await POST(
      buildRequest('POST', { firstName: 'John', lastName: 'Doe', email: 'dup@test.com' })
    );
    expect(res.status).toBe(409);
  });

  it('returns 409 when a user with the same email already exists', async () => {
    // First call: registration_requests → no existing
    const qbReg = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Second call: users → existing user found
    const qbUser = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-id' }, error: null }),
    });
    mockCreateClient.mockResolvedValue(
      createMockSupabase((table: string) => {
        if (table === 'registration_requests') return qbReg;
        return qbUser;
      })
    );

    const res = await POST(
      buildRequest('POST', { firstName: 'John', lastName: 'Doe', email: 'existing@test.com' })
    );
    expect(res.status).toBe(409);
  });

  it('returns 201 on successful registration', async () => {
    const insertedData: unknown = null;
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      }),
    });
    const mockSupabase = createMockSupabase(() => qb);
    // Override insert to capture data
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'registration_requests') {
        // Return different mock depending on call number
        return qb;
      }
      return qb;
    });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(
      buildRequest('POST', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        phone: '12345',
        playingLevel: 'advanced',
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('trims whitespace from names and lowercases email', async () => {
    let inserted = false;
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockImplementation((data: unknown) => {
        inserted = true;
        return qb;
      }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    await POST(
      buildRequest('POST', {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  JOHN@TEST.COM  ',
      })
    );

    expect(inserted).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// 2.  GET /api/admin/approvals
// ════════════════════════════════════════════════════════════
describe('GET /api/admin/approvals', () => {
  let GET: (req?: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/approvals/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/superadmin', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = createMockSupabase(() => qb);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 with requests array for admin', async () => {
    const mockRequests = [{ id: '1', first_name: 'John', status: 'pending' }];
    const qbMembership = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    });
    const qbRequests = createMockQueryBuilder({
      select: vi.fn(() => qbRequests),
      eq: vi.fn(() => qbRequests),
      in: vi.fn(() => qbRequests),
      order: vi.fn().mockResolvedValue({ data: mockRequests, error: null }),
    });

    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'user_club_memberships') return qbMembership;
      return qbRequests;
    });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual(mockRequests);
  });
});

// ════════════════════════════════════════════════════════════
// 3.  PATCH /api/admin/approvals
// ════════════════════════════════════════════════════════════
describe('PATCH /api/admin/approvals', () => {
  let PATCH: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/approvals/route');
    PATCH = mod.PATCH;
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await PATCH(buildRequest('PATCH', { id: 'req-1', status: 'approved' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id or status is missing', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { role: 'admin', club_id: 'club-1' }, error: null }),
    });
    const mockSupabase = createMockSupabase(() => qb);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await PATCH(buildRequest('PATCH', { status: 'approved' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not admin', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = createMockSupabase(() => qb);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await PATCH(buildRequest('PATCH', { id: 'req-1', status: 'approved' }));
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful rejection', async () => {
    const qbMembership = createMockQueryBuilder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { role: 'admin', club_id: 'club-1' }, error: null }),
    });
    const qbUpdate = createMockQueryBuilder({
      eq: vi.fn(() => qbUpdate),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'user_club_memberships') return qbMembership;
      return qbUpdate;
    });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await PATCH(
      buildRequest('PATCH', { id: 'req-1', status: 'rejected', rejectionReason: 'Voll' })
    );
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════
// 4.  GET /api/shop (products)
// ════════════════════════════════════════════════════════════
describe('GET /api/shop', () => {
  let GET: (req?: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/shop/route');
    GET = mod.GET;
  });

  it('returns 200 with products array', async () => {
    const mockProducts = [
      { id: 'p1', name: 'T-Shirt', price: 25, category: 'clothing', is_active: true },
      { id: 'p2', name: 'Cap', price: 15, category: 'accessories', is_active: true },
    ];
    const qb = createMockQueryBuilder({
      select: vi.fn(() => qb),
      eq: vi.fn(() => qb),
      order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toEqual(mockProducts);
    expect(body.products).toHaveLength(2);
  });
});

// ════════════════════════════════════════════════════════════
// 5.  POST /api/qr-checkin
// ════════════════════════════════════════════════════════════
describe('POST /api/qr-checkin', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/qr-checkin/route');
    POST = mod.POST;
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { sessionId: 'sess-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when neither sessionId nor qrToken is provided', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid QR token', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { qrToken: '!!not-valid-base64!!' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('QR');
  });

  it('decodes valid QR token to get sessionId', async () => {
    const token = Buffer.from(JSON.stringify({ sessionId: 'sess-decoded' })).toString('base64');

    // Session query returns null (not found)
    const qbSession = createMockQueryBuilder({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = createMockSupabase(() => qbSession);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { qrToken: token }));
    expect(res.status).toBe(404); // session not found
  });

  it('returns 404 when session does not exist', async () => {
    const qb = createMockQueryBuilder({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = createMockSupabase(() => qb);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { sessionId: 'sess-404' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when session is not today', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const qbSession = createMockQueryBuilder({
      single: vi.fn().mockResolvedValue({
        data: { id: 'sess-1', timeslot_start: yesterday, timeslot_end: yesterday, court_id: 'c1' },
        error: null,
      }),
    });
    const mockSupabase = createMockSupabase(() => qbSession);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { sessionId: 'sess-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Tag der Session');
  });

  it('returns 403 when no confirmed booking exists', async () => {
    const today = new Date().toISOString();
    const qbSession = createMockQueryBuilder({
      single: vi.fn().mockResolvedValue({
        data: { id: 'sess-1', timeslot_start: today, timeslot_end: today, court_id: 'c1' },
        error: null,
      }),
    });
    const qbBooking = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'sessions') return qbSession;
      if (table === 'bookings') return qbBooking;
      return createMockQueryBuilder();
    });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    const res = await POST(buildRequest('POST', { sessionId: 'sess-1' }));
    expect(res.status).toBe(403);
  });

  it('returns 200 for successful check-in with points', async () => {
    const today = new Date().toISOString();
    const qbSession = createMockQueryBuilder({
      single: vi.fn().mockResolvedValue({
        data: { id: 'sess-1', timeslot_start: today, timeslot_end: today, court_id: 'c1' },
        error: null,
      }),
    });
    const qbBooking = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'booking-1' }, error: null }),
    });
    const qbCheckin = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'sessions') return qbSession;
      if (table === 'bookings') return qbBooking;
      if (table === 'qr_checkins') return qbCheckin;
      return createMockQueryBuilder();
    });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

    // Admin client mock for gamification_points (RLS bypass)
    const qbGamification = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: { points: 50 }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockAdminSupabase = createMockSupabase(() => qbGamification);
    mockCreateAdminClient.mockResolvedValue(mockAdminSupabase);

    const res = await POST(buildRequest('POST', { sessionId: 'sess-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pointsAwarded).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// 6.  GET /api/coupons
// ════════════════════════════════════════════════════════════
describe('GET /api/coupons', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/coupons/route');
    GET = mod.GET;
  });

  it('returns 400 when no code is provided', async () => {
    const res = await GET(new NextRequest(new URL('http://localhost:3000/api/coupons')));
    expect(res.status).toBe(400);
  });

  it('returns valid:false for non-existent coupon', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await GET(
      new NextRequest(new URL('http://localhost:3000/api/coupons?code=INVALID'))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it('returns valid:false for expired coupon', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'c1',
          code: 'EXPIRED',
          discount_type: 'percentage',
          discount_value: 10,
          is_active: true,
          expires_at: yesterday,
          max_uses: null,
          used_count: 0,
        },
        error: null,
      }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await GET(
      new NextRequest(new URL('http://localhost:3000/api/coupons?code=EXPIRED'))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.message).toContain('abgelaufen');
  });

  it('returns valid:false when max uses reached', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'c1',
          code: 'MAXED',
          discount_type: 'fixed',
          discount_value: 5,
          is_active: true,
          expires_at: null,
          max_uses: 100,
          used_count: 100,
        },
        error: null,
      }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await GET(new NextRequest(new URL('http://localhost:3000/api/coupons?code=MAXED')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.message).toContain('Limit');
  });

  it('returns valid:true for valid coupon', async () => {
    const qb = createMockQueryBuilder({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'c1',
          code: 'VALID10',
          discount_type: 'percentage',
          discount_value: 10,
          is_active: true,
          expires_at: null,
          max_uses: null,
          used_count: 5,
          min_amount: null,
        },
        error: null,
      }),
    });
    mockCreateClient.mockResolvedValue(createMockSupabase(() => qb));

    const res = await GET(
      new NextRequest(new URL('http://localhost:3000/api/coupons?code=VALID10'))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.discountType).toBe('percentage');
    expect(body.discountValue).toBe(10);
  });
});

// ════════════════════════════════════════════════════════════
// 7.  GET /api/gamification
// ════════════════════════════════════════════════════════════
describe('GET /api/gamification', () => {
  let GET: () => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/gamification/route');
    GET = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuthApi.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with points, badges, streak, and leaderboard', async () => {
    const today = new Date().toISOString();

    // Leaderboard data
    const lbData = [
      { user_id: 'u1', points: 150, users: { full_name: 'Alice' } },
      { user_id: 'u2', points: 100, users: { full_name: 'Bob' } },
    ];

    // Single query builder that handles all gamification_points queries
    let pointsCallCount = 0;
    const qbPoints = createMockQueryBuilder();
    qbPoints.select = vi.fn(() => qbPoints);
    qbPoints.eq = vi.fn(() => qbPoints);
    qbPoints.order = vi.fn(() => qbPoints);
    qbPoints.limit = vi.fn(() => qbPoints);
    qbPoints.maybeSingle = vi.fn().mockImplementation(() => {
      pointsCallCount++;
      // First call: user's own points
      if (pointsCallCount === 1) return Promise.resolve({ data: { points: 150 }, error: null });
      // Second call: leaderboard (via .order().limit())
      return Promise.resolve({ data: null, error: null });
    });
    // Override the chain to return leaderboard data for the 2nd query
    qbPoints.order = vi.fn(() => {
      qbPoints.limit = vi.fn().mockResolvedValue({ data: lbData, error: null });
      return qbPoints;
    });

    const qbBadges = createMockQueryBuilder({
      select: vi.fn(() => qbBadges),
      eq: vi.fn(() => qbBadges),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'b1',
            name: 'Early Bird',
            description: 'First check-in',
            icon: '🌅',
            earned_at: today,
          },
          {
            id: 'b2',
            name: 'Streak 7',
            description: '7 Tage Streak',
            icon: '🔥',
            earned_at: today,
          },
        ],
        error: null,
      }),
    });
    const qbAttendance = createMockQueryBuilder({
      select: vi.fn(() => qbAttendance),
      eq: vi.fn(() => qbAttendance),
      order: vi.fn(() => qbAttendance),
      limit: vi.fn().mockResolvedValue({
        data: [{ created_at: today }, { created_at: today }],
        error: null,
      }),
    });

    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'gamification_points') return qbPoints;
      if (table === 'gamification_badges') return qbBadges;
      if (table === 'attendance_records') return qbAttendance;
      return createMockQueryBuilder();
    });

    mockRequireAuthApi.mockResolvedValue({ supabase: mockSupabase, user: { id: 'u1' } });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points).toBe(150);
    expect(body.badges).toHaveLength(2);
    expect(typeof body.streak).toBe('number');
    expect(body.leaderboard).toHaveLength(2);
    expect(body.leaderboard[0].name).toBe('Alice');
  });
});
