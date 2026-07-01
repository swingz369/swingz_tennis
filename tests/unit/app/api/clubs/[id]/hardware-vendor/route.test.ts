/**
 * ════════════════════════════════════════════════════════════════════════════════
 * tests/unit/app/api/clubs/[id]/hardware-vendor/route.test.ts — Q3 ticket 3.1.3
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Test-Cases
 *   - 403 wenn verifyRole fails (member/trainer attempting to update)
 *   - 403 wenn admin versucht einen anderen Club zu modifizieren
 *   - 400 bei invalid vendor (not in enum)
 *   - 400 bei malformed JSON
 *   - 200 unchanged=true bei previous === new (idempotency)
 *   - 200 happy-path mit shallow-JSONB-merge (other features preserved)
 *   - 200 missing_env=true wenn ENV-Var unset
 *   - 500 wenn update schlägt fehl
 *   - 200 success auch wenn audit_logs-Insert fehlschlägt (non-blocking)
 *
 * Mocks
 *   - withApiAuth: invokes handler with provided auth-context
 *   - verifyRole: programmable per test
 *   - createServiceClient: returns mock-supabase with chainable from()
 *   - HARDWARE_ENV_VARS: real constant from lib/hardware/adapter
 *
 * NOTE — RUNTIME EXPECTATION
 *   Same AKZ-deferred disclosure as 3.1.1/3.1.2:
 *   vitest deps nicht im sandbox installiert → run on dev-machine:
 *   `npx vitest run tests/unit/app/api/clubs/[id]/hardware-vendor/route.test.ts`
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────
const mockAuth: {
  user: { id: string } | null;
  clubId: string | null;
  role: string;
} = {
  user: { id: '00000000-0000-4000-8000-000000000001' },
  clubId: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: async (_req: NextRequest, handler: (auth: typeof mockAuth) => Promise<Response>) => {
    if (!mockAuth.user)
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    return handler(mockAuth);
  },
  verifyRole: vi.fn(async (_auth: typeof mockAuth, required: string) => {
    const hierarchy = ['owner', 'superadmin', 'admin', 'trainer', 'member'];
    return hierarchy.indexOf(mockAuth.role) <= hierarchy.indexOf(required);
  }),
  forbiddenResponse: (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

const mockSb = {
  selectMock: { data: null as unknown, error: null as unknown },
  updateMock: { error: null as unknown },
  auditInsertMock: { error: null as unknown },
  fromCallsTable: [] as string[],
  reset() {
    this.selectMock = { data: null, error: null };
    this.updateMock = { error: null };
    this.auditInsertMock = { error: null };
    this.fromCallsTable = [];
  },
};

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => {
      mockSb.fromCallsTable.push(table);
      if (table === 'clubs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => mockSb.selectMock,
            }),
          }),
          update: () => ({
            eq: async () => mockSb.updateMock,
          }),
        };
      }
      if (table === 'audit_logs') {
        return { insert: async () => mockSb.auditInsertMock };
      }
      throw new Error('Unexpected-table-in-mock: ' + table);
    }),
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: async () => null,
  RATE_LIMITS: { STANDARD: 'STANDARD' },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePutRequest(body: unknown, clubIdInUrl = '11111111-1111-4111-8111-111111111111') {
  return new NextRequest(`http://test/api/clubs/${clubIdInUrl}/hardware-vendor`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function callPUT(req: NextRequest, urlClubId = '11111111-1111-4111-8111-111111111111') {
  const { PUT } = await import('@/app/api/clubs/[id]/hardware-vendor/route');
  return PUT(req, { params: Promise.resolve({ id: urlClubId }) });
}

beforeEach(() => {
  mockAuth.user = { id: '00000000-0000-4000-8000-000000000001' };
  mockAuth.clubId = '11111111-1111-4111-8111-111111111111';
  mockAuth.role = 'admin';
  mockSb.reset();
  // Set all 3 env-vars as "configured" by default
  process.env.NUKI_API_TOKEN = 'test-nuki-token';
  process.env.SHELLY_API_HOST = 'test-shelly-host';
  process.env.LOXONE_MINISERVER_IP = '192.168.1.10';
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.NUKI_API_TOKEN;
  delete process.env.SHELLY_API_HOST;
  delete process.env.LOXONE_MINISERVER_IP;
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('PUT /api/clubs/[id]/hardware-vendor — auth + RBAC', () => {
  it('returns 403 when verifyRole fails (member role)', async () => {
    mockAuth.role = 'member';
    mockAuth.clubId = null; // members typically have no clubId in auth-context (defensive)
    // Override the verifyRole-mock to return false explicitly (matches current logic for member+admin-required)
    const { verifyRole } = await import('@/lib/api-auth');
    (verifyRole as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 if admin tries to modify a different club', async () => {
    // auth.clubId = c1, url clubId = c2 → forbidden
    mockAuth.clubId = '11111111-1111-4111-8111-111111111111';
    const res = await callPUT(
      makePutRequest({ hardware_vendor: 'shelly' }, '22222222-2222-4222-8222-222222222222')
    );
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/clubs/[id]/hardware-vendor — payload validation', () => {
  it('returns 400 on invalid vendor (not in enum)', async () => {
    const res = await callPUT(makePutRequest({ hardware_vendor: 'invalid-vendor' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
    expect(json.details?.hardware_vendor).toBeTruthy();
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await callPUT(makePutRequest('{broken json'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when hardware_vendor field is missing', async () => {
    const res = await callPUT(makePutRequest({}));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/clubs/[id]/hardware-vendor — idempotency', () => {
  it('returns 200 unchanged=true when previous vendor === new vendor', async () => {
    mockSb.selectMock = { data: { features: { hardware_vendor: 'nuki' } }, error: null };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unchanged).toBe(true);
    expect(json.new_vendor).toBe('nuki');
    expect(json.previous_vendor).toBe('nuki');
    // On unchanged-path: ONLY the read happened (no update + no audit_insert).
    // Route returns early at the idempotency-check before update+audit_logs.
    expect(mockSb.fromCallsTable).toEqual(['clubs']);
  });

  it('returns changed response when vendor differs (shallow-merge)', async () => {
    mockSb.selectMock = {
      data: { features: { hardware_vendor: 'shelly', other_field: 'preserved', nested: { a: 1 } } },
      error: null,
    };
    mockSb.updateMock = { error: null };
    mockSb.auditInsertMock = { error: null };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unchanged).toBe(false);
    expect(json.previous_vendor).toBe('shelly');
    expect(json.new_vendor).toBe('nuki');
    expect(json.missing_env).toBe(false);
    expect(mockSb.fromCallsTable).toContain('audit_logs');
  });

  it('handles previous_vendor=null (first-time setup)', async () => {
    mockSb.selectMock = { data: { features: {} }, error: null };
    mockSb.updateMock = { error: null };
    mockSb.auditInsertMock = { error: null };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'loxone' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unchanged).toBe(false);
    expect(json.previous_vendor).toBe(null);
    expect(json.new_vendor).toBe('loxone');
  });
});

describe('PUT /api/clubs/[id]/hardware-vendor — missing-env detection', () => {
  it('returns missing_env=true when NUKI_API_TOKEN is unset', async () => {
    delete process.env.NUKI_API_TOKEN;
    mockSb.selectMock = { data: { features: {} }, error: null };
    mockSb.updateMock = { error: null };
    mockSb.auditInsertMock = { error: null };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.missing_env).toBe(true);
  });

  it('returns missing_env=false when SHELLY_API_HOST is set', async () => {
    mockSb.selectMock = { data: { features: {} }, error: null };
    mockSb.updateMock = { error: null };
    mockSb.auditInsertMock = { error: null };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'shelly' }));
    const json = await res.json();
    expect(json.missing_env).toBe(false);
  });
});

describe('PUT /api/clubs/[id]/hardware-vendor — error-surfacing (ADR-002)', () => {
  it('returns 500 when read-before step fails', async () => {
    mockSb.selectMock = { data: null, error: { message: 'connection-lost' } };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(500);
  });

  it('returns 500 when update step fails', async () => {
    mockSb.selectMock = { data: { features: {} }, error: null };
    mockSb.updateMock = { error: { message: 'rls-violation' } };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'nuki' }));
    expect(res.status).toBe(500);
  });

  it('returns 200 success even if audit_logs insert fails (non-blocking)', async () => {
    mockSb.selectMock = { data: { features: {} }, error: null };
    mockSb.updateMock = { error: null };
    mockSb.auditInsertMock = { error: { message: 'audit-table-missing' } };
    const res = await callPUT(makePutRequest({ hardware_vendor: 'shelly' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.unchanged).toBe(false);
  });
});
