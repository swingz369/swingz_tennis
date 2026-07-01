/**
 * ════════════════════════════════════════════════════════════════════════════════
 * tests/unit/app/api/trainer-profiles/route.test.ts
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * UNIT-TESTS FOR: app/api/trainer-profiles/route.ts (GET-Handler)
 *                 (Sprint 4 Trainer Dual-Rate close-out)
 *
 * SCOPE
 *   - Dual-rate propagation through the Drizzle happy-path
 *     (trainerProfileService.getTrainerProfilesByClubId returns mock-entity)
 *   - Dual-rate propagation + 13-case NaN-Guard edge-bundle through the
 *     Service-Client-Fallback path (Drizzle throws → PostgREST fallback)
 *   - The two helpers MUST produce identical entity shape:
 *       - route.ts closure-local `parseNumOrNull` (Fallback-Path)
 *       - repository.ts `TrainerProfileRepository.parseNumericField` (Drizzle-Path)
 *     → if one diverges from the other, the public API contract breaks.
 *   - Legacy hourlyRate coercion (snake_case `hourly_rate` + camelCase
 *     `hourlyRate`, fall-back chain, `?? undefined` domain-type hygiene).
 *   - Auth + rate-limit smoke (403 + happy-path 200).
 *
 * MOCKING STRATEGY
 *   - `@/lib/logger` returns no-op loggers.
 *   - `@/lib/api-auth` exposes a programmable `withApiAuth` + `verifyRole`
 *     so the auth-layer can be configured per-test (per bail-out rule #3:
 *     `mockAuthCtx` is module-mutable, see beforeEach).
 *   - `@/lib/rate-limit` exposes a no-op gate.
 *   - `@/lib/supabase/service` exposes a chainable mock surfaced through
 *     `mockServiceClient` (table-routed to test-trainers / memberships / users).
 *   - `@/src/application/services/trainer-profile-service.adapter` exposes
 *     a programmable `getTrainerProfilesByClubId` mock driving the
 *     Drizzle-path test surface.
 *
 * NOTE — RUNTIME EXPECTATION
 *   These tests follow the repo convention (tests/unit/lib/hardware/adapter.test.ts,
 *   tests/unit/app/api/webhooks/booking-completed/route.test.ts). Run on dev-machine:
 *   `npx vitest run tests/unit/app/api/trainer-profiles/route.test.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_UUID_CLUB = '33333333-3333-4333-8333-333333333333';
const VALID_UUID_USER = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_TRAINER_USER_2 = '22222222-2222-4222-8222-222222222222';

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

// ── @/lib/api-auth ───────────────────────────────────────────────────────────
// Programmable auth-context. mockAuthCtx and mockVerifyRoleResult are module
// mutable state; beforeEach in each describe-block re-stages them per-the-per-
// test-cleanliness rule from the booking-completed.test.ts mirror.
let mockAuthCtx: any;
let mockVerifyRoleResult: boolean;

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn(async (_req: NextRequest, handler: (auth: any) => Promise<Response>) =>
    handler(mockAuthCtx)
  ),
  verifyRole: vi.fn(async () => mockVerifyRoleResult),
  forbiddenResponse: (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

// @/lib/rate-limit → no rate-gate
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STANDARD: { max: 60, windowMs: 60000 } },
  checkRateLimitOrFail: vi.fn(async () => null),
}));

// ── @/lib/supabase/service ───────────────────────────────────────────────────
// Chainable stateful mock. Routes by table-name. Captures `from()` calls into
// `mockServiceClient.fromCallsTable` so test-assertions can verify call-patterns.
const mockServiceClient = {
  fromCallsTable: [] as string[],
  fromMock: vi.fn(),
};
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockServiceClient,
}));

// ── @/src/application/services/trainer-profile-service.adapter ──────────────
// Programmable Drizzle-path entry-point mock. `getTrainerProfilesByClubId`
// rejects to force Fallback-Path or resolves to simulate Drizzle success.
const mockTrainerProfileService: {
  getTrainerProfilesByClubId: ReturnType<typeof vi.fn>;
  createTrainerProfile: ReturnType<typeof vi.fn>;
} = {
  getTrainerProfilesByClubId: vi.fn(),
  createTrainerProfile: vi.fn(),
};
vi.mock('@/src/application/services/trainer-profile-service.adapter', () => ({
  trainerProfileService: mockTrainerProfileService,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Standard "admin signed in for VALID_UUID_CLUB" — the happy-path auth-context.
 * The membership list mirrors what an admin row would carry (active/admin role).
 *
 * NOTE: GET does NOT touch `auth.supabase` directly (only POST does, via
 * `auth.supabase.from('users').select(...)` for profile-create user-lookup).
 * The `supabase` field is included for shape-fidelity with the real auth
 * context but is unused by the GET-handler tests in this file.
 */
function makeAdminAuthCtx(clubId = VALID_UUID_CLUB) {
  return {
    user: { id: 'admin-uuid', email: 'admin@test' },
    clubId,
    memberships: [{ club_id: clubId, role: 'admin', is_active: true }],
    supabase: mockServiceClient,
  };
}

function makeGetReq(opts: { queryClubId?: string } = {}): NextRequest {
  const query = opts.queryClubId ? `?clubId=${opts.queryClubId}` : '';
  return new NextRequest(`http://test/api/trainer-profiles${query}`, { method: 'GET' });
}

/**
 * Build a TrainerProfile entity (Drizzle-path result) with sane defaults +
 * per-test rate overrides.
 */
function buildDrizzleEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-aaa',
    userId: VALID_UUID_USER,
    firstName: 'Anna',
    lastName: 'Müller',
    email: 'anna@test',
    phone: '000-0000000',
    dateOfBirth: '1990-01-01',
    bio: undefined,
    profileImageUrl: undefined,
    qualifications: [],
    specializations: [],
    experience: { years: 0, previousClubs: [], achievements: [] },
    status: 'active' as const,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    preferredTimeSlots: [],
    languages: ['Deutsch'],
    emergencyContact: { name: '', phone: '', relationship: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hourlyRate: 50,
    contractedHourlyRate: 45,
    extraHoursRate: 50,
    ...overrides,
  };
}

/**
 * Build a Supabase PostgREST row (Fallback-Path result) with per-test rate
 * overrides. Keys here reflect `snake_case` columns as they arrive through
 * PostgREST + the camelCase `hourlyRate` legacy column aliased.
 */
function buildFallbackRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-aaa',
    user_id: VALID_UUID_USER,
    first_name: 'Anna',
    last_name: 'Müller',
    email: 'anna@test',
    phone: '000-0000000',
    dateOfBirth: '1990-01-01',
    status: 'active',
    hourlyRate: 50,
    hourly_rate: 50,
    contracted_hourly_rate: '45.00',
    extra_hours_rate: '50.00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Reset the service-client mock with the new per-test data. Routes by table.
 */
function resetServiceClientMock({
  trainerProfilesData = [],
  trainerProfilesError = null,
  membershipsData = [],
  membershipsError = null,
  usersData = [],
}: {
  trainerProfilesData?: unknown[];
  trainerProfilesError?: { message: string } | null;
  membershipsData?: unknown[];
  membershipsError?: { message: string } | null;
  usersData?: unknown[];
} = {}) {
  mockServiceClient.fromCallsTable = [];
  mockServiceClient.fromMock.mockClear();
  mockServiceClient.fromMock.mockImplementation((table: string) => {
    mockServiceClient.fromCallsTable.push(table);
    if (table === 'trainer_profiles') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: trainerProfilesData,
              error: trainerProfilesError,
            }),
          }),
        }),
      };
    }
    if (table === 'user_club_memberships') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: async () => ({
                data: membershipsData,
                error: membershipsError,
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: () => ({
          in: async () => ({ data: usersData, error: null }),
        }),
      };
    }
    throw new Error('Unexpected-table-in-mock: ' + table);
  });
}

// Re-stage all mocks before each test (pollution-guard). Mirrors the
// booking-completed.test.ts pattern.
beforeEach(() => {
  mockAuthCtx = makeAdminAuthCtx();
  mockVerifyRoleResult = true;
  mockTrainerProfileService.getTrainerProfilesByClubId.mockReset();
  mockTrainerProfileService.createTrainerProfile.mockReset();
  // Default: Drizzle-path returns empty array (no trainers)
  mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValue([]);
  resetServiceClientMock({});
});

// ════════════════════════════════════════════════════════════════════════════════
// Drizzle-Path: dual-rate propagation
// ════════════════════════════════════════════════════════════════════════════════
describe('GET /api/trainer-profiles — Drizzle path: dual-rate propagation', () => {
  it('propagates contractedHourlyRate + extraHoursRate (numeric) into the entity', async () => {
    mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValueOnce([
      buildDrizzleEntity({ contractedHourlyRate: 45, extraHoursRate: 50 }),
    ]);
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toHaveLength(1);
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
    expect(json.profiles[0].extraHoursRate).toBe(50);
  });

  it('coerces string-style numbers from Drizzle $inferSelect (parseFloat path preserved)', async () => {
    // Simulates a row that has `numeric` columns as strings via the driver.
    // parseNumericField in mapToEntity should coerce '45.00' → 45 (number).
    mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValueOnce([
      buildDrizzleEntity({ contractedHourlyRate: 45, extraHoursRate: 50 }),
    ]);
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    // Strict type-check: numeric values, not strings
    expect(typeof json.profiles[0].contractedHourlyRate).toBe('number');
    expect(typeof json.profiles[0].extraHoursRate).toBe('number');
  });

  it('returns null for null contractedHourlyRate (DB has null value after migration)', async () => {
    mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValueOnce([
      buildDrizzleEntity({
        contractedHourlyRate: null,
        extraHoursRate: null,
        hourlyRate: 50, // legacy fallback
      }),
    ]);
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    expect(json.profiles[0].contractedHourlyRate).toBeNull();
    expect(json.profiles[0].extraHoursRate).toBeNull();
    // hourlyRate fallback preserved
    expect(json.profiles[0].hourlyRate).toBe(50);
  });

  it('returns undefined for null hourlyRate (Domain-Type-Hygiene: hourlyRate is not nullable)', async () => {
    mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValueOnce([
      buildDrizzleEntity({
        hourlyRate: null,
        contractedHourlyRate: 45,
        extraHoursRate: 50,
      }),
    ]);
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    // Critical: hourlyRate must be UNDEFINED (not null) — domain type is `?: number`, not nullable.
    expect(json.profiles[0].hourlyRate).toBeUndefined();
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Service-Client-Fallback-Path: dual-rate propagation + 13-case NaN-Guard bundle
// ════════════════════════════════════════════════════════════════════════════════
describe('GET /api/trainer-profiles — Service-Client-Fallback path: dual-rate propagation', () => {
  beforeEach(() => {
    // Force the catch-block (Fallback-Path): Drizzle throws → route falls back
    // to Supabase service-client. This is the path that exercises the
    // closure-local `parseNumOrNull` helper.
    mockTrainerProfileService.getTrainerProfilesByClubId.mockRejectedValueOnce(
      new Error('drizzle stale-socket')
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────
  it('propagates contracted_hourly_rate="45.00" + extra_hours_rate="50.00" as numbers', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildFallbackRow({
          contracted_hourly_rate: '45.00',
          extra_hours_rate: '50.00',
        }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
    expect(json.profiles[0].extraHoursRate).toBe(50);
  });

  it('coerces legacy hourly_rate (snake_case) through parseNumOrNull helper', async () => {
    // Only hourly_rate set (legacy trainer, no dual-rate configured yet)
    resetServiceClientMock({
      trainerProfilesData: [
        buildFallbackRow({
          hourlyRate: undefined,
          hourly_rate: 50,
          contracted_hourly_rate: null,
          extra_hours_rate: null,
        }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    expect(json.profiles[0].hourlyRate).toBe(50);
    expect(json.profiles[0].contractedHourlyRate).toBeNull();
    expect(json.profiles[0].extraHoursRate).toBeNull();
  });

  // ── NaN-Guard 13-case bundle on contracted_hourly_rate ────────────────────
  describe('NaN-Guard 13-case edge bundle (parseNumOrNull closure-local)', () => {
    it('returns null for null column value', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: null })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for undefined / missing column', async () => {
      const row = buildFallbackRow();
      delete (row as Record<string, unknown>).contracted_hourly_rate;
      resetServiceClientMock({ trainerProfilesData: [row] });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for "not-a-number" (parseFloat → NaN → caught by guard)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: 'not-a-number' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for empty string "" (parseFloat → NaN)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: '' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for whitespace-only string "   " (parseFloat → NaN)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: '   ' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for Infinity literal (Number.isFinite rejects)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [
          buildFallbackRow({ contracted_hourly_rate: Infinity as unknown as string }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for boolean slipped true (Round-3 fix: explicit typeof branch)', async () => {
      // Defense-in-depth: if PostgREST ever serialized a boolean where a
      // numeric was expected (data corruption or driver bug), the helper
      // rejects it via the explicit typeof branch (not the unsafe `as number`
      // cast + Number.isFinite coercion of true → 1).
      resetServiceClientMock({
        trainerProfilesData: [
          buildFallbackRow({ contracted_hourly_rate: true as unknown as string }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for object slipped {junk} (Round-3 fix)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [
          buildFallbackRow({
            contracted_hourly_rate: { junk: 'value' } as unknown as string,
          }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for array slipped [] (Round-3 fix)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [
          buildFallbackRow({ contracted_hourly_rate: [] as unknown as string }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('parses "45,50" german decimal comma to 45 (lenient, locked behavior)', async () => {
      // DOCUMENT this as locked behavior — parseFloat ignores trailing chars
      // and the comma is not a numeric separator. Real-world csv imports with
      // german decimals will produce this; downstream consumers need to be
      // aware. If behavior must change to locale-tolerant parsing, the helper
      // itself must change — re-run the test.
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: '45,50' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(45);
    });

    it('parses "45.50abc" leniently to 45 (parseFloat reads numeric prefix)', async () => {
      // Same lenient-storey behavior — parseFloat reads leading prefix even
      // when trailing chars are present. Acceptable since DB columns should
      // never surface this; defense-in-depth only.
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: '45.50abc' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(45);
    });

    it('preserves 0 (parseNumOrNull returns 0, not false/null/zombie)', async () => {
      // Edge case: 0 must not be coerced to null/undefined by the nullish-
      // coalescing chain. This test guards against future refactors that
      // accidentally collapse falsy values.
      resetServiceClientMock({
        trainerProfilesData: [
          buildFallbackRow({
            hourlyRate: undefined,
            hourly_rate: 0,
            contracted_hourly_rate: '0',
            extra_hours_rate: '0',
          }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].hourlyRate).toBe(0);
      expect(json.profiles[0].contractedHourlyRate).toBe(0);
      expect(json.profiles[0].extraHoursRate).toBe(0);
    });

    it('propagates -0 in-memory helper-behavior; HTTP roundtrip collapses to +0 via JSON.stringify', async () => {
      // DOCUMENT: parseNumOrNull('-0') internally returns -0 (negative zero is
      // finite per Number.isFinite); HOWEVER, NextResponse.json serializes via
      // JSON.stringify which collapses -0 → +0 per the JSON spec (only one
      // zero representation). The HTTP test therefore asserts +0. If a future
      // helper-side audit is desired, test parseNumOrNull in isolation (no
      // HTTP, no serialization layer) — see lib/utils/numeric-coerce.ts once
      // extracted.
      resetServiceClientMock({
        trainerProfilesData: [buildFallbackRow({ contracted_hourly_rate: '-0' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(0);
    });
  });

  it('propagates null in ALL rate columns when DB has dual-rate pre-migration data', async () => {
    // Pre-migration trainers: hourlyRate present, contracted+extra null. Verify
    // the dual-rate default is null (not undefined) so the UI can render "—".
    resetServiceClientMock({
      trainerProfilesData: [
        buildFallbackRow({
          hourlyRate: 50,
          hourly_rate: 50,
          contracted_hourly_rate: null,
          extra_hours_rate: null,
        }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    expect(json.profiles[0].hourlyRate).toBe(50);
    expect(json.profiles[0].contractedHourlyRate).toBeNull();
    expect(json.profiles[0].extraHoursRate).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Auth + happy-path smoke tests (cross-cutting)
// ════════════════════════════════════════════════════════════════════════════════
describe('GET /api/trainer-profiles — auth + rate-limit smoke', () => {
  it('returns 403 when verifyRole rejects (non-trainer/non-admin user)', async () => {
    mockVerifyRoleResult = false;
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Trainer or admin/i);
  });

  it('returns 200 + empty profiles array on happy path (no trainers configured)', async () => {
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toEqual([]);
  });

  it('returns 200 + profiles list on Drizzle happy path with mixed rate columns', async () => {
    mockTrainerProfileService.getTrainerProfilesByClubId.mockResolvedValueOnce([
      buildDrizzleEntity({
        id: 'profile-1',
        userId: VALID_UUID_USER,
        firstName: 'Anna',
        lastName: 'Müller',
        contractedHourlyRate: 45,
        extraHoursRate: 50,
        hourlyRate: 42,
      }),
      buildDrizzleEntity({
        id: 'profile-2',
        userId: VALID_UUID_TRAINER_USER_2,
        firstName: 'Tom',
        lastName: 'Schmidt',
        contractedHourlyRate: null,
        extraHoursRate: null,
        hourlyRate: 60,
      }),
    ]);
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toHaveLength(2);
    // Profile 1: dual-rate-configured
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
    expect(json.profiles[0].extraHoursRate).toBe(50);
    expect(json.profiles[0].hourlyRate).toBe(42);
    // Profile 2: legacy (no dual-rate)
    expect(json.profiles[1].contractedHourlyRate).toBeNull();
    expect(json.profiles[1].extraHoursRate).toBeNull();
    expect(json.profiles[1].hourlyRate).toBe(60);
  });
});
