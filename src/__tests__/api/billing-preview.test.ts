/**
 * Unit tests for POST /api/seasons/[id]/wizard/billing-preview
 *
 * Tests the billing preview calculation: maps plan entries to fee
 * configurations and returns per-member billing estimates.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const SEASON_ID = 'season-001';
const CLUB_ID = 'club-001';

// ════════════════════════════════════════════════════════════
// MOCK AUTH — same pattern as confirm-publish tests
// ════════════════════════════════════════════════════════════

const mockSupabaseFrom = vi.fn();

const mockAuthCtx = {
  user: { id: 'user-001', email: 'admin@test.com' },
  clubId: CLUB_ID,
  supabase: {
    from: mockSupabaseFrom,
  } as any,
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) =>
    fn(mockAuthCtx)
  ),
  verifyRole: vi.fn().mockResolvedValue(true),
  forbiddenResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function buildRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/seasons/${SEASON_ID}/wizard/billing-preview`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function ctx(id: string = SEASON_ID) {
  return { params: Promise.resolve({ id }) };
}

/** Creates a Supabase chain mock that resolves to `{ data, error }` */
function supabaseChain(
  data: unknown[] | null,
  error: { message: string } | null = null
) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (
    resolve: (v: unknown) => unknown,
    _reject: (e: unknown) => unknown
  ) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/seasons/[id]/wizard/billing-preview', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import(
      '@/app/api/seasons/[id]/wizard/billing-preview/route'
    );
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
  });

  // ──────────────────────────────────────────────────────────
  // SUCCESS PATHS
  // ──────────────────────────────────────────────────────────

  it('returns billing preview with fee configs applied', async () => {
    const entries = [
      { member_id: 'member-001', group_id: 'group-001' },
      { member_id: 'member-002', group_id: 'group-002' },
    ];

    const feeConfigs = [
      {
        id: 'fee-001',
        amount: 29.99,
        billing_cycle: 'monthly',
        conditions: { trainingGroup: 'group-001' },
      },
      {
        id: 'fee-002',
        amount: 49.99,
        billing_cycle: 'season',
        conditions: { trainingGroup: 'group-002' },
      },
    ];

    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(entries))
      .mockReturnValueOnce(supabaseChain(feeConfigs));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(2);
    // member-001 → fee-001 (29.99, monthly, group-001 condition match)
    expect(body[0]).toMatchObject({
      memberId: 'member-001',
      groupId: 'group-001',
      amount: 29.99,
      feeConfigId: 'fee-001',
      billingCycle: 'monthly',
    });
    // member-002 → fee-002 (49.99, season, group-002 condition match)
    expect(body[1]).toMatchObject({
      memberId: 'member-002',
      groupId: 'group-002',
      amount: 49.99,
      feeConfigId: 'fee-002',
      billingCycle: 'season',
    });
  });

  it('returns billing preview with unconditional fallback fee', async () => {
    const entries = [
      { member_id: 'member-001', group_id: 'group-001' },
    ];

    // No conditions → matches any entry
    const feeConfigs = [
      {
        id: 'fee-default',
        amount: 19.99,
        billing_cycle: 'season',
        conditions: null,
      },
    ];

    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(entries))
      .mockReturnValueOnce(supabaseChain(feeConfigs));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].amount).toBe(19.99);
    expect(body[0].feeConfigId).toBe('fee-default');
  });

  it('returns zero amount when no fee config matches', async () => {
    const entries = [
      { member_id: 'member-001', group_id: 'group-003' },
    ];

    // Fee only for group-001 — group-003 has no match
    const feeConfigs = [
      {
        id: 'fee-001',
        amount: 29.99,
        billing_cycle: 'monthly',
        conditions: { trainingGroup: 'group-001' },
      },
    ];

    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(entries))
      .mockReturnValueOnce(supabaseChain(feeConfigs));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].amount).toBe(0);
    expect(body[0].feeConfigId).toBe(null);
  });

  it('returns empty array for no plan entries', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain([]))
      .mockReturnValueOnce(supabaseChain([]));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it('handles null entries gracefully', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(null))
      .mockReturnValueOnce(supabaseChain([]));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it('handles null fee configs gracefully (zero amounts)', async () => {
    const entries = [{ member_id: 'member-001', group_id: 'group-001' }];

    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(entries))
      .mockReturnValueOnce(supabaseChain(null));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].amount).toBe(0);
  });

  it('handles installment billing cycle', async () => {
    const entries = [
      { member_id: 'member-001', group_id: 'group-001' },
    ];

    const feeConfigs = [
      {
        id: 'fee-installment',
        amount: 120.0,
        billing_cycle: 'installment',
        installment_count: 3,
        conditions: null,
      },
    ];

    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain(entries))
      .mockReturnValueOnce(supabaseChain(feeConfigs));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body[0].billingCycle).toBe('installment');
    expect(body[0].installments).toBe(3);
  });

  // ──────────────────────────────────────────────────────────
  // ERROR PATHS
  // ──────────────────────────────────────────────────────────

  it('returns 500 when entries query fails', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(
        supabaseChain(null, { message: 'Database connection error' })
      )
      .mockReturnValueOnce(supabaseChain([]));

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Database connection error');
  });

  it('returns 500 when fee configs query fails', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(supabaseChain([]))
      .mockReturnValueOnce(
        supabaseChain(null, { message: 'Permission denied' })
      );

    const res = await POST(buildRequest(), ctx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Permission denied');
  });
});
