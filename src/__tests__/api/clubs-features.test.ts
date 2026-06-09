import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mock state (must run before vi.mock factories) ─────────────

const mock = vi.hoisted(() => {
  return {
    // State shared between tests and the mock factories
    dbRows: [] as any[],
    throwOnSelect: false,
    throwOnUpdate: false,
    lastUpdate: null as null | { features: Record<string, boolean> },

    // Auth handler registry — tests push an auth context, withApiAuth pops it
    nextAuth: null as null | any,
  };
});

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STANDARD: { windowMs: 60_000, max: 100 } },
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn(async (_req: NextRequest, handler: (auth: any) => Promise<Response>) => {
    if (!mock.nextAuth) {
      throw new Error('No auth registered for this test');
    }
    const auth = mock.nextAuth;
    mock.nextAuth = null;
    return await handler(auth);
  }),
  verifyRole: vi.fn(async (auth: any, required: string) => {
    const order = ['member', 'trainer', 'admin', 'superadmin'];
    const userLevel = order.indexOf(auth.role);
    const requiredLevel = order.indexOf(required);
    return userLevel >= requiredLevel;
  }),
  forbiddenResponse: (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('@/infrastructure/persistence/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (mock.throwOnSelect) throw new Error('DB select failed');
            return mock.dbRows;
          },
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (values: any) => ({
        where: async (_condition: any) => {
          if (mock.throwOnUpdate) throw new Error('DB update failed');
          mock.lastUpdate = { features: values.features };
          return { rowCount: 1 };
        },
      }),
    })),
  },
}));

vi.mock('@/infrastructure/persistence/schema', () => ({
  clubs: {
    id: { name: 'id' },
    features: { name: 'features' },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: any, b: any) => ({ __eq: b })),
}));

// Route handlers are imported AFTER all mocks are registered.
import { GET, PUT } from '@/app/api/clubs/[id]/features/route';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeRequest(method = 'GET', body?: any): NextRequest {
  const init: RequestInit =
    body !== undefined
      ? { method, body: typeof body === 'string' ? body : JSON.stringify(body) }
      : { method };
  return new NextRequest(new URL('http://localhost/api/clubs/club-1/features'), init);
}

function asAdmin(clubId = 'club-1') {
  return {
    user: { id: 'user-1' },
    session: null,
    supabase: {} as any,
    clubId,
    role: 'admin' as const,
    roles: ['admin'],
    memberships: [{ club_id: clubId, role: 'admin' }],
  };
}

function asSuperadmin() {
  return {
    user: { id: 'user-1' },
    session: null,
    supabase: {} as any,
    clubId: null,
    selectedClubId: 'club-1',
    role: 'superadmin' as const,
    roles: ['superadmin'],
    memberships: [{ club_id: null, role: 'superadmin' }],
  };
}

function asMember(clubId = 'club-1') {
  return {
    user: { id: 'user-2' },
    session: null,
    supabase: {} as any,
    clubId,
    role: 'member' as const,
    roles: ['member'],
    memberships: [{ club_id: clubId, role: 'member' }],
  };
}

function withAuth<T>(auth: any, fn: () => Promise<T>): Promise<T> {
  mock.nextAuth = auth;
  return fn();
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: 'club-1' }) } as any;

beforeEach(() => {
  mock.dbRows = [];
  mock.throwOnSelect = false;
  mock.throwOnUpdate = false;
  mock.lastUpdate = null;
  mock.nextAuth = null;
  vi.clearAllMocks();
});

// ── GET ─────────────────────────────────────────────────────────────────

describe('GET /api/clubs/[id]/features', () => {
  it('returns sanitized feature flags for a club admin', async () => {
    mock.dbRows = [
      {
        features: {
          members: true,
          trainers: true,
          seasons: true,
          finance: true,
          shop: true,
          tournaments: false,
          trial_training: false,
          ai_matchmaking: false,
        },
      },
    ];

    const res = await withAuth(asAdmin('club-1'), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.shop).toBe(true);
    expect(body.features.tournaments).toBe(false);
  });

  it('returns sanitized feature flags for a superadmin (any club)', async () => {
    mock.dbRows = [
      {
        features: {
          members: true,
          trainers: true,
          seasons: true,
          finance: true,
          shop: true,
          tournaments: true,
          trial_training: false,
          ai_matchmaking: true,
        },
      },
    ];

    const res = await withAuth(asSuperadmin(), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.shop).toBe(true);
    expect(body.features.tournaments).toBe(true);
    expect(body.features.ai_matchmaking).toBe(true);
  });

  it('forces core features to true even if DB has them off', async () => {
    mock.dbRows = [
      {
        features: {
          members: false,
          trainers: false,
          seasons: false,
          finance: false,
          shop: true,
          tournaments: false,
        },
      },
    ];

    const res = await withAuth(asAdmin('club-1'), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.members).toBe(true);
    expect(body.features.trainers).toBe(true);
    expect(body.features.seasons).toBe(true);
    expect(body.features.finance).toBe(true);
  });

  it('returns 403 when a member of a different club requests', async () => {
    const res = await withAuth(asMember('club-2'), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('No access to this club');
  });

  it('returns 404 when the club does not exist', async () => {
    mock.dbRows = []; // empty result
    const res = await withAuth(asAdmin('club-1'), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mock.throwOnSelect = true;
    const res = await withAuth(asAdmin('club-1'), () => GET(makeRequest(), ROUTE_PARAMS));
    expect(res.status).toBe(500);
  });
});

// ── PUT ─────────────────────────────────────────────────────────────────

describe('PUT /api/clubs/[id]/features', () => {
  it('updates the feature flags for a club admin', async () => {
    const res = await withAuth(asAdmin('club-1'), () =>
      PUT(makeRequest('PUT', { shop: true, tournaments: true }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.shop).toBe(true);
    expect(body.features.tournaments).toBe(true);
    // Core features remain true
    expect(body.features.members).toBe(true);
    expect(body.features.trainers).toBe(true);
    expect(mock.lastUpdate).not.toBeNull();
  });

  it('refuses to disable core features even if requested', async () => {
    const res = await withAuth(asAdmin('club-1'), () =>
      PUT(makeRequest('PUT', { members: false, trainers: false }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.members).toBe(true); // forced back to true
    expect(body.features.trainers).toBe(true);
  });

  it('returns 403 when the caller is not an admin (member)', async () => {
    const res = await withAuth(asMember('club-1'), () =>
      PUT(makeRequest('PUT', { shop: true }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when the admin belongs to a different club', async () => {
    const res = await withAuth(asAdmin('club-2'), () =>
      PUT(makeRequest('PUT', { shop: true }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller is a trainer (not admin)', async () => {
    const trainerAuth = {
      user: { id: 'user-3' },
      session: null,
      supabase: {} as any,
      clubId: 'club-1',
      role: 'trainer' as const,
      roles: ['trainer'],
      memberships: [{ club_id: 'club-1', role: 'trainer' }],
    };
    const res = await withAuth(trainerAuth, () =>
      PUT(makeRequest('PUT', { shop: true }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid payload (non-boolean value)', async () => {
    const res = await withAuth(asAdmin('club-1'), () =>
      PUT(makeRequest('PUT', { shop: 'yes' }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON body', async () => {
    const res = await withAuth(asAdmin('club-1'), () =>
      PUT(makeRequest('PUT', 'not-json{'), ROUTE_PARAMS)
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error during update', async () => {
    mock.throwOnUpdate = true;
    const res = await withAuth(asAdmin('club-1'), () =>
      PUT(makeRequest('PUT', { shop: true }), ROUTE_PARAMS)
    );
    expect(res.status).toBe(500);
  });
});
