/**
 * Unit tests for training-groups API routes
 *
 * Tests GET, POST (collection), PATCH, DELETE (by ID) endpoints
 * with mocked Supabase and auth.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const CLUB_ID = 'club-001';
const GROUP_ID = 'group-001';
const USER_ID = 'user-admin-001';

// ════════════════════════════════════════════════════════════
// MOCK STATE
// ════════════════════════════════════════════════════════════

let mockVerifyRole: ReturnType<typeof vi.fn>;

const mockAuthCtx = {
  user: { id: USER_ID, email: 'admin@test.com' },
  clubId: CLUB_ID,
  supabase: {
    from: vi.fn(),
  } as any,
};

const mockForbiddenResponse = vi.fn(
  (msg?: string) =>
    new Response(JSON.stringify({ error: msg || 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
);

// ── Module mocks ────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  verifyRole: (...args: unknown[]) => mockVerifyRole(...args),
  forbiddenResponse: (...args: unknown[]) => mockForbiddenResponse(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STANDARD: { max: 20, windowMs: 60000 } },
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

/** Creates a Supabase chain mock (select → eq → order → then) */
function supabaseSelectChain(data: unknown | null, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, _reject: (e: unknown) => unknown) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

/** Creates a Supabase insert chain (insert → select → single → then) */
function supabaseInsertChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, _reject: (e: unknown) => unknown) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

/** Creates a Supabase update chain (update → eq → eq → select → single → then) */
function supabaseUpdateChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, _reject: (e: unknown) => unknown) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

/** Creates a Supabase delete chain (delete → eq → eq → then) */
function supabaseDeleteChain(error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, _reject: (e: unknown) => unknown) => {
    resolve({ error });
    return chain;
  };
  return chain;
}

/** Sets up the supabase.from mock to return a given chain */
function givenSupabaseChain(chain: Record<string, any>) {
  (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

// ════════════════════════════════════════════════════════════
// TESTS — GET (collection)
// ════════════════════════════════════════════════════════════

describe('GET /api/training-groups', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/training-groups/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReset();
  });

  it('returns all training groups', async () => {
    const groups = [
      { id: 'g1', name: 'Anfänger A', schedule_id: 'sched-001' },
      { id: 'g2', name: 'Fortgeschrittene', schedule_id: 'sched-001' },
    ];
    givenSupabaseChain(supabaseSelectChain(groups));

    const req = new NextRequest('http://localhost/api/training-groups');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(groups);
    expect(mockAuthCtx.supabase.from).toHaveBeenCalledWith('training_groups');
  });

  it('returns 200 for GET with query params (ignored, no season_id column)', async () => {
    givenSupabaseChain(supabaseSelectChain([]));

    const req = new NextRequest('http://localhost/api/training-groups?seasonId=season-001');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 500 on Supabase error', async () => {
    givenSupabaseChain(supabaseSelectChain(null, { message: 'Internal error' }));

    const req = new NextRequest('http://localhost/api/training-groups');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Internal error');
  });

  it('returns 403 when user is not admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost/api/training-groups');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// TESTS — POST (create)
// ════════════════════════════════════════════════════════════

describe('POST /api/training-groups', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/training-groups/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReset();
  });

  const validGroup = {
    name: 'Anfänger Gruppe A',
    level: 'beginner',
    age_group: 'adults',
    season_id: 'season-001',
  };

  /** Sets up mock chains for season lookup + schedule find/create + group insert */
  function setupPostMocks(
    season: unknown,
    schedule: { id: string; error: null } | { id: null; error: { message: string } },
    groupInsert: { data: unknown; error: { message: string } | null }
  ) {
    const fromMock = mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>;
    fromMock.mockImplementation((table: string) => {
      if (table === 'seasons') {
        const c: Record<string, any> = {};
        c.select = vi.fn(() => c);
        c.eq = vi.fn(() => c);
        c.single = vi.fn(() => c);
        c.then = (resolve: (v: unknown) => unknown) => {
          resolve({ data: season, error: null });
          return c;
        };
        return c;
      }
      if (table === 'schedules') {
        if (schedule.id !== null) {
          // find existing
          const c: Record<string, any> = {};
          c.select = vi.fn(() => c);
          c.eq = vi.fn(() => c);
          c.limit = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => unknown) => {
            resolve({ data: [{ id: schedule.id }], error: null });
            return c;
          };
          return c;
        }
        // upsert error case
        const c: Record<string, any> = {};
        c.select = vi.fn(() => c);
        c.eq = vi.fn(() => c);
        c.limit = vi.fn(() => c);
        c.upsert = vi.fn(() => c);
        c.single = vi.fn(() => c);
        let firstCall = true;
        c.then = (resolve: (v: unknown) => unknown) => {
          if (firstCall) {
            firstCall = false;
            resolve({ data: [], error: null });
          } else {
            resolve({ data: null, error: schedule.error });
          }
          return c;
        };
        return c;
      }
      if (table === 'training_groups') {
        const c: Record<string, any> = {};
        c.insert = vi.fn(() => c);
        c.select = vi.fn(() => c);
        c.single = vi.fn(() => c);
        c.then = (resolve: (v: unknown) => unknown) => {
          resolve(groupInsert);
          return c;
        };
        return c;
      }
      return supabaseSelectChain([]);
    });
  }

  it('creates a training group and returns 201', async () => {
    const season = {
      id: 'season-001',
      club_id: CLUB_ID,
      season_type: 'summer',
      year: 2026,
      start_date: '2026-06-01',
      end_date: '2026-09-30',
    };
    const created = {
      id: 'new-group-001',
      name: 'Anfänger Gruppe A',
      level: 'beginner',
      schedule_id: 'sched-001',
      is_active: true,
    };
    setupPostMocks(season, { id: 'sched-001', error: null }, { data: created, error: null });

    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validGroup),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('new-group-001');
    expect(body.name).toBe('Anfänger Gruppe A');
  });

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'beginner' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('name');
  });

  it('returns 400 when level is missing', async () => {
    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('level');
  });

  it('returns 400 when season_id is missing', async () => {
    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', level: 'beginner' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('season_id');
  });

  it('returns 500 on Supabase insert error', async () => {
    const season = {
      id: 'season-001',
      club_id: CLUB_ID,
      season_type: 'summer',
      year: 2026,
      start_date: '2026-06-01',
      end_date: '2026-09-30',
    };
    setupPostMocks(
      season,
      { id: 'sched-001', error: null },
      { data: null, error: { message: 'Unique constraint violation' } }
    );

    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validGroup),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Unique constraint');
  });

  it('returns 403 when user is not admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost/api/training-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validGroup),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// TESTS — PATCH (update by ID)
// ════════════════════════════════════════════════════════════

describe('PATCH /api/training-groups/[id]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/training-groups/[id]/route');
    PATCH = mod.PATCH;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReset();
  });

  function ctx(id: string = GROUP_ID) {
    return { params: Promise.resolve({ id }) };
  }

  it('updates a training group and returns updated data', async () => {
    const updated = { id: GROUP_ID, name: 'Anfänger B', level: 'intermediate', club_id: CLUB_ID };
    givenSupabaseChain(supabaseUpdateChain(updated));

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anfänger B', level: 'intermediate' }),
    });
    const res = await PATCH(req, ctx());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Anfänger B');
  });

  it('returns 500 on Supabase update error', async () => {
    givenSupabaseChain(supabaseUpdateChain(null, { message: 'Record not found' }));

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req, ctx());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Record not found');
  });

  it('returns 403 when user is not admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req, ctx());

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// TESTS — DELETE (delete by ID)
// ════════════════════════════════════════════════════════════

describe('DELETE /api/training-groups/[id]', () => {
  let DELETE_FN: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/training-groups/[id]/route');
    DELETE_FN = mod.DELETE;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReset();
  });

  function ctx(id: string = GROUP_ID) {
    return { params: Promise.resolve({ id }) };
  }

  it('deletes a training group and returns 204', async () => {
    givenSupabaseChain(supabaseDeleteChain());

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE_FN(req, ctx());

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('returns 500 on Supabase delete error', async () => {
    givenSupabaseChain(supabaseDeleteChain({ message: 'Foreign key constraint' }));

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE_FN(req, ctx());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Foreign key constraint');
  });

  it('returns 403 when user is not admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest(`http://localhost/api/training-groups/${GROUP_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE_FN(req, ctx());

    expect(res.status).toBe(403);
  });
});
