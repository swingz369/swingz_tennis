/**
 * ════════════════════════════════════════════════════════════════════════════════
 * src/__tests__/api/trainer-profiles.route.test.ts
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * UNIT-TESTS FOR: app/api/trainer-profiles/route.ts (GET-Handler)
 *
 * Umgebaut für ADR-005 (13.09.2026): Die Route hat keinen Drizzle-Pfad und
 * keinen Service-Client-Fallback mehr — beides lief über die inzwischen
 * entfernte BYPASSRLS-Drizzle-Verbindung. Es gibt nur noch EINEN Weg:
 * getUserDb(auth) → TrainerProfileRepository → PostgREST. Die
 * ursprünglichen zwei Testpfade ("Drizzle path" / "Service-Client-Fallback
 * path") sind deshalb zu einem zusammengeführt; die fachlich wertvollen
 * Assertions (Dual-Rate-Propagation, 13-Fall-NaN-Guard-Bündel,
 * hourlyRate-undefined-vs-null-Semantik) bleiben unverändert erhalten —
 * TrainerProfileRepository.parseNumericField ist bytegleich mit der alten
 * Drizzle-Repository-Guard-Funktion.
 *
 * SCOPE
 *   - Dual-rate propagation durch TrainerProfileRepository.mapToEntity.
 *   - 13-Fall-NaN-Guard-Bündel auf contracted_hourly_rate.
 *   - Legacy-hourlyRate-Coercion (`hourly_rate` snake_case Spalte).
 *   - Auth + Rate-Limit-Smoke (403 + Happy-Path 200).
 *
 * MOCKING STRATEGY
 *   - `@/lib/logger` → no-op.
 *   - `@/lib/api-auth` → programmierbarer `withApiAuth` + `verifyRole`.
 *   - `@/lib/rate-limit` → kein Rate-Gate.
 *   - `@/lib/supabase/service` → chainbarer Mock für die
 *     Mitgliedschafts-/Auto-Provisioning-Abfragen (createServiceClient).
 *   - `auth.supabase` (dieselbe Mock-Instanz) deckt den getUserDb(auth)-Pfad
 *     ab, über den TrainerProfileRepository tatsächlich läuft.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_UUID_CLUB = '33333333-3333-4333-8333-333333333333';
const VALID_UUID_USER = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_TRAINER_USER_2 = '22222222-2222-4222-8222-222222222222';

// ─── Module-Mocks (hoisted via vi.mock) ───────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

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

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STANDARD: { max: 60, windowMs: 60000 } },
  checkRateLimitOrFail: vi.fn(async () => null),
}));

// Chainable stateful mock, routed by table name. Serves BOTH createServiceClient()
// (Mitgliedschafts-/Users-Lookups) UND auth.supabase (getUserDb-Pfad für
// trainer_profiles) — dieselbe Instanz deckt beide Konsumenten ab.
const mockServiceClient: {
  fromCallsTable: string[];
  fromMock: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} = {
  fromCallsTable: [] as string[],
  fromMock: vi.fn(),
  from: vi.fn(),
};
mockServiceClient.from = mockServiceClient.fromMock;
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockServiceClient,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
 * Baut eine rohe `trainer_profiles`-Zeile, wie sie via PostgREST
 * zurückkommt — snake_case Spaltennamen, `numeric`-Spalten teils als String
 * (Treiber-Eigenheit), die TrainerProfileRepository.parseNumericField
 * abfängt.
 */
function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-aaa',
    user_id: VALID_UUID_USER,
    first_name: 'Anna',
    last_name: 'Müller',
    email: 'anna@test',
    phone: '000-0000000',
    date_of_birth: '1990-01-01',
    bio: null,
    profile_image_url: null,
    qualifications: [],
    specializations: [],
    experience: { years: 0, previousClubs: [], achievements: [] },
    status: 'active',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    preferred_time_slots: [],
    languages: ['Deutsch'],
    emergency_contact: { name: '', phone: '', relationship: '' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hourly_rate: 50,
    contracted_hourly_rate: '45.00',
    extra_hours_rate: '50.00',
    ...overrides,
  };
}

/**
 * Programmiert den Service-Client-Mock neu. `trainerProfilesData` deckt
 * sowohl den createServiceClient()-Konsumenten als auch auth.supabase
 * (getUserDb-Pfad) ab, da beide dieselbe Mock-Instanz sind.
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

beforeEach(() => {
  mockAuthCtx = makeAdminAuthCtx();
  mockVerifyRoleResult = true;
  resetServiceClientMock({});
});

// ════════════════════════════════════════════════════════════════════════════════
// Dual-rate propagation
// ════════════════════════════════════════════════════════════════════════════════
describe('GET /api/trainer-profiles — dual-rate propagation', () => {
  it('propagates contracted_hourly_rate="45.00" + extra_hours_rate="50.00" as numbers', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildRow({ contracted_hourly_rate: '45.00', extra_hours_rate: '50.00' }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toHaveLength(1);
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
    expect(json.profiles[0].extraHoursRate).toBe(50);
    expect(typeof json.profiles[0].contractedHourlyRate).toBe('number');
    expect(typeof json.profiles[0].extraHoursRate).toBe('number');
  });

  it('coerces legacy hourly_rate (snake_case) through parseNumericField', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildRow({ hourly_rate: 50, contracted_hourly_rate: null, extra_hours_rate: null }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    expect(json.profiles[0].hourlyRate).toBe(50);
    expect(json.profiles[0].contractedHourlyRate).toBeNull();
    expect(json.profiles[0].extraHoursRate).toBeNull();
  });

  it('returns undefined for null hourlyRate (Domain-Type-Hygiene: hourlyRate is not nullable)', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildRow({ hourly_rate: null, contracted_hourly_rate: '45.00', extra_hours_rate: '50.00' }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    // Kritisch: hourlyRate muss UNDEFINED sein (nicht null) — Domain-Typ ist `?: number`, nicht nullable.
    expect(json.profiles[0].hourlyRate).toBeUndefined();
    expect(json.profiles[0].contractedHourlyRate).toBe(45);
  });

  it('propagates null in ALL rate columns when DB has dual-rate pre-migration data', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildRow({ hourly_rate: 50, contracted_hourly_rate: null, extra_hours_rate: null }),
      ],
    });
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    const json = await res.json();
    expect(json.profiles[0].hourlyRate).toBe(50);
    expect(json.profiles[0].contractedHourlyRate).toBeNull();
    expect(json.profiles[0].extraHoursRate).toBeNull();
  });

  // ── NaN-Guard 13-Fall-Bündel auf contracted_hourly_rate ────────────────────
  describe('NaN-Guard 13-case edge bundle (TrainerProfileRepository.parseNumericField)', () => {
    it('returns null for null column value', async () => {
      resetServiceClientMock({ trainerProfilesData: [buildRow({ contracted_hourly_rate: null })] });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for undefined / missing column', async () => {
      const row = buildRow();
      delete (row as Record<string, unknown>).contracted_hourly_rate;
      resetServiceClientMock({ trainerProfilesData: [row] });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for "not-a-number" (parseFloat → NaN → caught by guard)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: 'not-a-number' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for empty string "" (parseFloat → NaN)', async () => {
      resetServiceClientMock({ trainerProfilesData: [buildRow({ contracted_hourly_rate: '' })] });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for whitespace-only string "   " (parseFloat → NaN)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: '   ' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for Infinity literal (Number.isFinite rejects)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: Infinity as unknown as string })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for boolean slipped true (explicit typeof branch)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: true as unknown as string })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for object slipped {junk}', async () => {
      resetServiceClientMock({
        trainerProfilesData: [
          buildRow({ contracted_hourly_rate: { junk: 'value' } as unknown as string }),
        ],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('returns null for array slipped []', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: [] as unknown as string })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBeNull();
    });

    it('parses "45,50" german decimal comma to 45 (lenient, locked behavior)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: '45,50' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(45);
    });

    it('parses "45.50abc" leniently to 45.5 (parseFloat reads numeric prefix)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: '45.50abc' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(45.5);
    });

    it('preserves 0 (parseNumericField returns 0, not false/null/zombie)', async () => {
      resetServiceClientMock({
        trainerProfilesData: [
          buildRow({ hourly_rate: 0, contracted_hourly_rate: '0', extra_hours_rate: '0' }),
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
      resetServiceClientMock({
        trainerProfilesData: [buildRow({ contracted_hourly_rate: '-0' })],
      });
      const { GET } = await import('@/app/api/trainer-profiles/route');
      const res = await GET(makeGetReq());
      const json = await res.json();
      expect(json.profiles[0].contractedHourlyRate).toBe(0);
    });
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
    expect(json.error).toMatch(/Trainer oder Admin/i);
  });

  it('returns 200 + empty profiles array on happy path (no trainers configured)', async () => {
    const { GET } = await import('@/app/api/trainer-profiles/route');
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toEqual([]);
  });

  it('returns 200 + profiles list with mixed rate columns', async () => {
    resetServiceClientMock({
      trainerProfilesData: [
        buildRow({
          id: 'profile-1',
          user_id: VALID_UUID_USER,
          first_name: 'Anna',
          last_name: 'Müller',
          contracted_hourly_rate: '45.00',
          extra_hours_rate: '50.00',
          hourly_rate: 42,
        }),
        buildRow({
          id: 'profile-2',
          user_id: VALID_UUID_TRAINER_USER_2,
          first_name: 'Tom',
          last_name: 'Schmidt',
          contracted_hourly_rate: null,
          extra_hours_rate: null,
          hourly_rate: 60,
        }),
      ],
    });
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
