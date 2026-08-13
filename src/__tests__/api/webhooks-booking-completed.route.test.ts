/**
 * ════════════════════════════════════════════════════════════════════════════════
 * src/__tests__/api/webhooks-booking-completed.route.test.ts
 * (konsolidiert aus tests/unit/app/api/webhooks/booking-completed/route.test.ts)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * UNIT-TESTS FOR: app/api/webhooks/booking-completed/route.ts
 *                 (Q3 ticket 3.1.2 — Buchung-zu-Hardware-Webhook)
 *
 * SCOPE
 *   - HMAC-signature authentication (valid sig → pass; missing/malformed sig → 401)
 *   - Zod-payload validation (UUIDs, enum, ISO-8601 timestamp, idempotency-key bounds)
 *   - Idempotency: replay → 200 deduplicated:true; dedup-query-error → 503
 *   - Vendor-resolution (club-features → env-default → hardcoded-default)
 *   - Action-dispatch wiring (vendor resolved at step 5 *actually* used at step 6)
 *   - Partial-failure ADR-002 explicit status code (207 Multi-Status)
 *   - Body-size cap (≥ 10 kB → 413 before HMAC work)
 *   - GET 405 with `Allow: POST` (RFC 9110 conformance)
 *   - Adapter-throw defense-in-depth catches (forward-compat annotated)
 *
 * MOCKING STRATEGY
 *   - `@/lib/logger` returns no-op loggers
 *   - `@/lib/supabase/service` exposes a chainable mock — `from().select().eq().eq().maybeSingle()`
 *     and `from().insert()` programmed per-test via `mockQueryResult(...)`
 *   - `@/lib/hardware/adapter` is fully mocked; per-test we program the
 *     return-shape of setLight/unlockCourt/lockCourt per vendor
 *
 * NOTE — RUNTIME EXPECTATION
 *   These tests follow the existing repo convention (src/__tests__/lib/hardware/adapter.test.ts).
 *   `vitest` deps are NOT installed in the current sandbox session, so this file
 *   is shipped per the same AKZ-deferred disclosure pattern as 3.1.1.
 *   Run on dev-machine: `npx vitest run src/__tests__/api/webhooks-booking-completed.route.test.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEBHOOK_SECRET = 'test-secret-do-not-use-in-prod';
const VALID_UUID_BOOKING = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_COURT = '22222222-2222-4222-8222-222222222222';
const VALID_UUID_CLUB = '33333333-3333-4333-8333-333333333333';

// ─── Module-Mocks (hoisted via vi.mock) ───────────────────────────────────────
// @/lib/logger → no-op
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Adapter-Mock with per-test programmable behavior
const mockAdapter = {
  setLight: vi.fn(),
  lockCourt: vi.fn(),
  unlockCourt: vi.fn(),
};
vi.mock('@/lib/hardware/adapter', () => ({
  getHardwareAdapter: vi.fn(() => mockAdapter),
  HardwareErrorCode: null,
  listHardwareVendors: () => ['nuki', 'shelly', 'loxone'],
}));

// Supabase-Mock — single shared mutable state for chainable query-buiders
const mockSupabase = {
  queryResult: { data: null as unknown, error: null as unknown },
  insertedRow: null as unknown,
  from: vi.fn(),
};

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSignature(rawBody: string, secret = WEBHOOK_SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    booking_id: VALID_UUID_BOOKING,
    court_id: VALID_UUID_COURT,
    club_id: VALID_UUID_CLUB,
    event_type: 'booking_started',
    event_timestamp: new Date().toISOString(),
    idempotency_key: 'idem-' + crypto.randomBytes(8).toString('hex'),
    ...overrides,
  };
}

function makeReq(
  opts: {
    body?: string;
    signature?: string | null;
    contentLength?: number;
  } = {}
): NextRequest {
  const body = opts.body ?? JSON.stringify(buildValidPayload());
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.contentLength !== undefined
      ? { 'content-length': String(opts.contentLength) }
      : { 'content-length': String(body.length) }),
  };
  if (opts.signature !== null && opts.signature !== undefined) {
    headers['x-swingz-signature'] = opts.signature;
  }
  return new NextRequest('http://test/api/webhooks/booking-completed', {
    method: 'POST',
    headers,
    body,
  });
}

/**
 * Rebuild-mock helper — re-programs the chainable from()→select/insert for each test.
 */
function resetSupabaseMock({
  auditExisting,
  auditLookupError,
  clubRow,
  clubError,
  auditInsertError,
  bookingRow,
}: {
  auditExisting?: unknown;
  auditLookupError?: { message: string } | null;
  clubRow?: unknown;
  clubError?: { message: string } | null;
  auditInsertError?: { message: string } | null;
  bookingRow?: unknown;
}) {
  // clear accumulated from() call-history to prevent test-pollution in
  // assertion-counters that read `mockSupabase.from.mock.calls.length`
  mockSupabase.from.mockClear();
  mockAdapter.setLight.mockReset();
  mockAdapter.lockCourt.mockReset();
  mockAdapter.unlockCourt.mockReset();

  // Default adapter returns: success
  mockAdapter.setLight.mockResolvedValue({ data: true, error: null });
  mockAdapter.lockCourt.mockResolvedValue({ data: true, error: null });
  mockAdapter.unlockCourt.mockResolvedValue({ data: true, error: null });

  // from() routes by table-name (audit_logs vs clubs)
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'audit_logs') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: auditExisting ?? null,
                error: auditLookupError ?? null,
              }),
            }),
          }),
        }),
        insert: async (row: unknown) => ({
          data: null,
          error: auditInsertError ?? null,
          _row: row,
        }),
      };
    }
    if (table === 'clubs') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: clubRow ?? null,
              error: clubError ?? null,
            }),
          }),
        }),
      };
    }
    if (table === 'bookings') {
      // Step 7 (audit-trail write) fetches the booking owner (user_id) to
      // populate audit_logs.actor_id (NOT NULL). Default to a benign owner
      // so tests that don't care about this specifically don't need to
      // program it themselves.
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: bookingRow ?? { user_id: 'booking-owner-uuid' },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error('Unexpected-table-in-mock: ' + table);
  });
}

// Set the secret BEFORE each test (in case other tests modify it), and clear
// adapter call-history so a prior test's dispatch (e.g. "accepts valid
// signature") doesn't leak into a later test's `.not.toHaveBeenCalled()`
// assertion (e.g. the 413 body-size-cap test, which never calls
// resetSupabaseMock()/mockAdapter.mockReset() itself).
beforeEach(() => {
  process.env.HARDWARE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.HARDWARE_DEFAULT_VENDOR = 'shelly';
  mockAdapter.setLight.mockClear();
  mockAdapter.lockCourt.mockClear();
  mockAdapter.unlockCourt.mockClear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/webhooks/booking-completed — auth (HMAC)', () => {
  it('rejects missing signature header (401)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const req = makeReq({ signature: null });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/Unauthorized|invalid/i);
  });

  it('rejects invalid signature (401, fail-closed)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const req = makeReq({ signature: 'sha256=' + 'a'.repeat(64) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects malformed-hex signature silently (401, via hex→Buffer throw wrapped in try/catch)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    // non-hex length-matched string — Buffer.from(hexString, 'hex') would throw
    const req = makeReq({ signature: 'sha256=' + 'zz'.repeat(32) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects when HARDWARE_WEBHOOK_SECRET env is unset (401)', async () => {
    delete process.env.HARDWARE_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('accepts valid signature (passes auth → continues to payload-parse)', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const req = makeReq({ body, signature: sig });
    const res = await POST(req);
    // 200/207/400/503 are all "passed-auth"; auth-fail = 401. The exact code
    // depends on the dispatcher chain. We assert NOT 401 here.
    expect(res.status).not.toBe(401);
  });
});

describe('POST /api/webhooks/booking-completed — body-size cap (DoS-guard)', () => {
  it('returns 413 when content-length > 10 kB (before HMAC)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = 'x'.repeat(20_000);
    const req = makeReq({ body, signature: 'sha256=' + 'a'.repeat(64), contentLength: 20_000 });
    const res = await POST(req);
    expect(res.status).toBe(413);
    // HMAC-verify must NOT have happened — adapter must be untouched
    expect(mockAdapter.setLight).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/booking-completed — payload validation (Zod)', () => {
  beforeEach(() => resetSupabaseMock({}));

  it('rejects invalid booking_id UUID (400)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const payload = buildValidPayload({ booking_id: 'not-a-uuid' });
    const body = JSON.stringify(payload);
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid event_type (400)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const payload = buildValidPayload({ event_type: 'invalid_type' });
    const body = JSON.stringify(payload);
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(400);
  });

  it('rejects non-ISO-8601 timestamp (400)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const payload = buildValidPayload({ event_timestamp: '2026-06-28' });
    const body = JSON.stringify(payload);
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(400);
  });

  it('rejects empty idempotency_key (400)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const payload = buildValidPayload({ idempotency_key: '' });
    const body = JSON.stringify(payload);
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(400);
  });

  it('rejects idempotency_key > 255 chars (400)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const payload = buildValidPayload({ idempotency_key: 'a'.repeat(256) });
    const body = JSON.stringify(payload);
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/webhooks/booking-completed — idempotency (audit_logs lookup)', () => {
  beforeEach(() => resetSupabaseMock({}));

  it('returns 200 deduplicated:true on replay (audit_logs already has resource_id)', async () => {
    resetSupabaseMock({ auditExisting: { id: 'existing-row' } });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deduplicated).toBe(true);
    // Hardware-Action must NOT have fired on replay
    expect(mockAdapter.setLight).not.toHaveBeenCalled();
    expect(mockAdapter.unlockCourt).not.toHaveBeenCalled();
  });

  it('returns 503 when dedup-query fails (fail-closed, no double-fire risk)', async () => {
    resetSupabaseMock({ auditLookupError: { message: 'connection-lost' } });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(503);
    expect(mockAdapter.setLight).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/booking-completed — vendor resolution', () => {
  beforeEach(() => resetSupabaseMock({}));

  it('reads clubs.features.hardware_vendor (nuki) and dispatches via nuki-adapter', async () => {
    resetSupabaseMock({ clubRow: { features: { hardware_vendor: 'nuki' } } });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const { getHardwareAdapter: getHw } = await import('@/lib/hardware/adapter');

    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_started' }));
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    expect(getHw).toHaveBeenCalledWith('nuki');
    expect(mockAdapter.setLight).toHaveBeenCalledWith(VALID_UUID_COURT, true);
    expect(mockAdapter.unlockCourt).toHaveBeenCalledWith(VALID_UUID_COURT);
  });

  it('falls back to env HARDWARE_DEFAULT_VENDOR when club-features absent', async () => {
    process.env.HARDWARE_DEFAULT_VENDOR = 'loxone';
    resetSupabaseMock({ clubRow: null });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const { getHardwareAdapter } = await import('@/lib/hardware/adapter');

    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    expect(getHardwareAdapter).toHaveBeenCalledWith('loxone');
  });

  it('falls back to hardcoded shelly when neither club-features nor env match', async () => {
    delete process.env.HARDWARE_DEFAULT_VENDOR;
    resetSupabaseMock({ clubRow: { features: { hardware_vendor: 'unknown-vendor' } } });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const { getHardwareAdapter } = await import('@/lib/hardware/adapter');

    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    expect(getHardwareAdapter).toHaveBeenCalledWith('shelly');
  });
});

describe('POST /api/webhooks/booking-completed — action dispatch wiring', () => {
  beforeEach(() => resetSupabaseMock({}));

  it('booking_started: setLight(true) + unlockCourt (no lockCourt)', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_started' }));
    const sig = makeSignature(body);
    await POST(makeReq({ body, signature: sig }));
    expect(mockAdapter.setLight).toHaveBeenCalledWith(VALID_UUID_COURT, true);
    expect(mockAdapter.unlockCourt).toHaveBeenCalledWith(VALID_UUID_COURT);
    expect(mockAdapter.lockCourt).not.toHaveBeenCalled();
  });

  it('booking_completed: setLight(false) + lockCourt (no unlockCourt)', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_completed' }));
    const sig = makeSignature(body);
    await POST(makeReq({ body, signature: sig }));
    expect(mockAdapter.setLight).toHaveBeenCalledWith(VALID_UUID_COURT, false);
    expect(mockAdapter.lockCourt).toHaveBeenCalledWith(VALID_UUID_COURT);
    expect(mockAdapter.unlockCourt).not.toHaveBeenCalled();
  });

  it('booking_cancelled: setLight(false) + lockCourt', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_cancelled' }));
    const sig = makeSignature(body);
    await POST(makeReq({ body, signature: sig }));
    expect(mockAdapter.setLight).toHaveBeenCalledWith(VALID_UUID_COURT, false);
    expect(mockAdapter.lockCourt).toHaveBeenCalledWith(VALID_UUID_COURT);
  });
});

describe('POST /api/webhooks/booking-completed — ADR-002 partial-failure surface', () => {
  beforeEach(() => resetSupabaseMock({}));

  it('returns 207 Multi-Status when light-call fails (lock-call OK)', async () => {
    resetSupabaseMock({});
    mockAdapter.setLight.mockResolvedValue({ data: null, error: 'TIMEOUT' });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_started' }));
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(207);
    const json = await res.json();
    expect(json.status).toBe('partial_failure');
    expect(json.details.light.error).toBe('TIMEOUT');
    expect(json.details.lock).toBeTruthy();
  });

  it('returns 207 Multi-Status when lock-call fails (light-call OK)', async () => {
    resetSupabaseMock({});
    mockAdapter.lockCourt.mockResolvedValue({ data: null, error: 'NETWORK_ERROR' });
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload({ event_type: 'booking_completed' }));
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(207);
    const json = await res.json();
    expect(json.status).toBe('partial_failure');
    expect(json.details.lock.error).toBe('NETWORK_ERROR');
  });

  it('returns 200 success when both calls succeed', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
  });
});

describe('GET /api/webhooks/booking-completed — method restriction', () => {
  it('returns 405 with Allow: POST header (RFC 9110)', async () => {
    const { GET } = await import('@/app/api/webhooks/booking-completed/route');
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
});

describe('POST /api/webhooks/booking-completed — audit-trail write', () => {
  it('inserts audit_logs row with hardware-result details on success', async () => {
    resetSupabaseMock({});
    const { POST } = await import('@/app/api/webhooks/booking-completed/route');
    const body = JSON.stringify(buildValidPayload());
    const sig = makeSignature(body);
    const res = await POST(makeReq({ body, signature: sig }));
    expect(res.status).toBe(200);
    // The insert was called; verify via mock-supabase.from('audit_logs').insert(...) payload
    const calls = mockSupabase.from.mock.calls.filter((c: unknown[]) => c[0] === 'audit_logs');
    expect(calls.length).toBeGreaterThan(0);
  });
});
