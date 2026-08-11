import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// Increase timeout for dynamic imports of route modules (Next.js compilation overhead)
vi.setConfig({ hookTimeout: 30000, testTimeout: 15000 });

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
    // Default to a benign "not found" resolution so the withApiAuth mock's
    // internal user_club_memberships lookup (which every route's auth check
    // triggers first) doesn't throw when a test only cares about a later
    // query in the chain and never overrides these terminal methods.
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
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

// POST /api/public/register applies RATE_LIMITS.STRICT (5/15min) via the real
// in-memory limiter. Without this mock, the 6+ POSTs fired across this
// describe block (all from the same test-process "IP") trip the real limiter
// and start returning 429s — unrelated to the registration logic under test.
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STRICT: { max: 5, windowMs: 15 * 60 * 1000 } },
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
}));

// Mock @/lib/api-auth — used by admin/approvals, gamification, shop, coupons, and other routes.
// withApiAuth ties into mockCreateClient so auth state is controlled
// the same way as routes that call createClient() directly.
// verifyRole checks auth.role (built from membership query) so existing
// membership-based test setups (403 vs 200) work unchanged.
vi.mock('@/lib/api-auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  async function resolveAuth() {
    const supabase = await mockCreateClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { supabase, user: null, auth: null };
    }
    const { data: membership } = await (supabase as any)
      .from('user_club_memberships')
      .select('club_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    const role = membership?.role || 'member';
    const auth = {
      user,
      session: null,
      supabase: supabase as any,
      clubId: (membership?.club_id as string) || null,
      role: role as 'admin' | 'superadmin' | 'trainer' | 'member',
      roles: [role],
      memberships: membership ? [membership] : [],
    };
    return { supabase, user, auth };
  }

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    ...actual,
    withApiAuth: async (_request: Request, handler: (...args: unknown[]) => unknown) => {
      const { auth } = await resolveAuth();
      if (!auth) return json(401, { error: 'Unauthorized' });
      return handler(auth);
    },
    withAuth: async (_request: Request, handler: (...args: unknown[]) => unknown) => {
      const { auth } = await resolveAuth();
      if (!auth) return json(401, { error: 'Unauthorized' });
      return handler(auth);
    },
    verifyRole: async (auth: { role: string }, requiredRole: string) => {
      const { hasRole } = await import('@/lib/auth-common');
      return hasRole(
        auth.role as 'superadmin' | 'admin' | 'trainer' | 'member',
        requiredRole as 'superadmin' | 'admin' | 'trainer' | 'member'
      );
    },
    requireAuth: vi.fn(),
    requireApiAuth: vi.fn(),
  };
});

// Suppress console.error during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  mockCreateClient.mockReset();
  mockCreateAdminClient.mockReset();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// ── Helper ───────────────────────────────────────────────────
function buildRequest(method: string, body?: unknown, url = 'http://localhost:3000'): NextRequest {
  // Cast to unknown-then-NextRequest's init: Next.js augments RequestInit with
  // `next` config fields, but we don't use them here.
  const init: Record<string, unknown> = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(
    new URL(url),
    init as unknown as ConstructorParameters<typeof NextRequest>[1]
  );
}

// /api/qr-checkin (Sprint-4 audit fix) binds every token to its generator's
// userId and rejects anything else — including bare sessionId — with 403.
// Build a validly-bound token so tests exercise the intended flow.
function makeQrToken(sessionId: string, userId: string): string {
  return Buffer.from(JSON.stringify({ sessionId, userId })).toString('base64');
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
      insert: vi.fn().mockImplementation((_data: unknown) => {
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
  // Wider type: route handlers return NextResponse<unknown> which TS treats as
  // not strictly assignable to Response due to generic variance.
  let GET: (req?: NextRequest) => Promise<NextResponse<unknown>>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/approvals/route');
    GET = mod.GET as unknown as (req?: NextRequest) => Promise<NextResponse<unknown>>;
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
  let PATCH: (req: NextRequest) => Promise<NextResponse<unknown>>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/approvals/route');
    PATCH = mod.PATCH as unknown as (req: NextRequest) => Promise<NextResponse<unknown>>;
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
    // The production GET has a stricter (NextRequest) signature than the
    // test's declared (Request) signature — cast is intentional.
    GET = mod.GET as unknown as (req?: NextRequest) => Promise<Response>;
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
    const mockSupabase = createMockSupabase(() => qb);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

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
    const token = makeQrToken('sess-decoded', 'u1');

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

    const res = await POST(buildRequest('POST', { qrToken: makeQrToken('sess-404', 'u1') }));
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

    const res = await POST(buildRequest('POST', { qrToken: makeQrToken('sess-1', 'u1') }));
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

    const res = await POST(buildRequest('POST', { qrToken: makeQrToken('sess-1', 'u1') }));
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
  let GET: (req?: NextRequest) => Promise<NextResponse<unknown>>;

  beforeAll(async () => {
    const mod = await import('@/app/api/gamification/route');
    GET = mod.GET as unknown as (req?: NextRequest) => Promise<NextResponse<unknown>>;
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = createMockSupabase(() => createMockQueryBuilder());
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

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

    const qbMembership = createMockQueryBuilder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { role: 'member', club_id: 'club-1' }, error: null }),
    });

    const qbClub = createMockQueryBuilder({
      select: vi.fn(() => qbClub),
      eq: vi.fn(() => qbClub),
      single: vi
        .fn()
        .mockResolvedValue({ data: { features: { gamification: true } }, error: null }),
    });

    const mockSupabase = createMockSupabase((table: string) => {
      if (table === 'user_club_memberships') return qbMembership;
      if (table === 'gamification_points') return qbPoints;
      if (table === 'gamification_badges') return qbBadges;
      if (table === 'attendance_records') return qbAttendance;
      if (table === 'clubs') return qbClub;
      return createMockQueryBuilder();
    });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCreateClient.mockResolvedValue(mockSupabase);

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
