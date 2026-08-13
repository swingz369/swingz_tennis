/**
 * Unit tests for POST /api/seasons/[id]/billing-preview
 *
 * Die Route reimplementiert die historische Billing-Preview (Fee-Config-
 * Matching) auf Basis von `feeConfigurationService` (Drizzle-Adapter) und der
 * puren Funktion `computeBillingPreview` aus `@/lib/billing/billing-preview`.
 *
 * Getestet werden: Tenant-Isolation (authorizeSeasonAccess), DB-Fehlerpfade,
 * Teilnehmer-Expansion (expected_participants → ein Preview-Item je Mitglied)
 * und das Fee-Matching durch die Route hindurch.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const SEASON_ID = 'season-001';
const CLUB_ID = 'club-001';

// ════════════════════════════════════════════════════════════
// MOCK STATE
// ════════════════════════════════════════════════════════════

let mockAccessOk = true;
let mockEntriesError: { message: string } | null = null;
let mockFeeConfigs: unknown[] = [];

const mockSupabase = { from: vi.fn() };
const mockAuthCtx = {
  user: { id: 'user-001', email: 'admin@test.com' },
  clubId: CLUB_ID,
  supabase: mockSupabase,
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
}));

vi.mock('@/lib/season-auth', () => ({
  authorizeSeasonAccess: vi.fn(async () =>
    mockAccessOk
      ? { ok: true, season: { id: SEASON_ID, club_id: CLUB_ID } }
      : {
          ok: false,
          response: new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        }
  ),
}));

vi.mock('@/src/application/services/fee-configuration-service.adapter', () => ({
  feeConfigurationService: {
    getActiveFeeConfigurations: vi.fn(async () => mockFeeConfigs),
  },
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function buildRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/seasons/${SEASON_ID}/billing-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function ctx(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: SEASON_ID }) };
}

function stubEntries(
  rows: Array<{ group_id: string | null; expected_participants: string[] | null }>
) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'season_plan_entries') {
      throw new Error('Unexpected-table-in-mock: ' + table);
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: rows,
          error: mockEntriesError,
        })),
      })),
    };
  });
}

beforeEach(() => {
  mockAccessOk = true;
  mockEntriesError = null;
  mockFeeConfigs = [];
  mockSupabase.from.mockReset();
});

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/seasons/[id]/billing-preview', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/seasons/[id]/billing-preview/route'));
  });

  it('returns 403 when authorizeSeasonAccess rejects (Tenant-Isolation)', async () => {
    mockAccessOk = false;
    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(403);
  });

  it('returns 500 when the plan-entries query fails', async () => {
    mockEntriesError = { message: 'connection-lost' };
    stubEntries([]);
    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/connection-lost/);
  });

  it('returns an empty preview array when no plan entries exist', async () => {
    stubEntries([]);
    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it('matches a group-specific fee config through the route', async () => {
    stubEntries([{ group_id: 'group-beginner', expected_participants: ['m1'] }]);
    mockFeeConfigs = [
      {
        id: 'fee-beginner',
        name: 'Anfänger',
        type: 'training',
        amount: 25.0,
        currency: 'EUR',
        billingCycle: 'monthly',
        isActive: true,
        conditions: { trainingGroup: ['group-beginner'] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      memberId: 'm1',
      groupId: 'group-beginner',
      amount: 25.0,
      feeConfigId: 'fee-beginner',
      billingCycle: 'monthly',
      installments: 1,
    });
  });

  it('falls back to the unconditional fee config when the group does not match', async () => {
    stubEntries([{ group_id: 'group-unknown', expected_participants: ['m1'] }]);
    mockFeeConfigs = [
      {
        id: 'fee-default',
        name: 'Standard',
        type: 'other',
        amount: 15.0,
        currency: 'EUR',
        billingCycle: 'season',
        isActive: true,
        conditions: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const res = await POST(buildRequest(), ctx());
    const json = await res.json();
    expect(json[0].amount).toBe(15.0);
    expect(json[0].feeConfigId).toBe('fee-default');
  });

  it('expands expected_participants into one preview item per member', async () => {
    stubEntries([{ group_id: 'group-a', expected_participants: ['m1', 'm2', 'm3'] }]);
    mockFeeConfigs = [
      {
        id: 'fee-a',
        name: 'Gruppe A',
        type: 'training',
        amount: 40.0,
        currency: 'EUR',
        billingCycle: 'season',
        isActive: true,
        conditions: { trainingGroup: ['group-a'] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(3);
    expect(json.map((item: { memberId: string }) => item.memberId)).toEqual(['m1', 'm2', 'm3']);
    expect(json[0].feeConfigId).toBe('fee-a');
  });

  it('skips entries without a group_id (defensive)', async () => {
    stubEntries([
      { group_id: null, expected_participants: ['m1'] },
      { group_id: 'group-b', expected_participants: ['m2'] },
    ]);
    mockFeeConfigs = [
      {
        id: 'fee-default',
        name: 'Standard',
        type: 'other',
        amount: 15.0,
        currency: 'EUR',
        billingCycle: 'season',
        isActive: true,
        conditions: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const res = await POST(buildRequest(), ctx());
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].memberId).toBe('m2');
  });
});
