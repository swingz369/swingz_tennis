import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (must come before importing the service) ─────────────────────────

// Chainable helper for Supabase .from() / .select() / .eq() / .in() / .maybeSingle() / .single()
function makeChainable(result: { data: unknown; error: unknown }) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined; // not a promise at the leaf
      if (prop === 'data' || prop === 'error') {
        // Only resolve at the leaf — .single() / .maybeSingle() returns { data, error }
        return result[prop as 'data' | 'error'];
      }
      // Return a proxy that resolves to the same result regardless of which
      // method the chain ends with (.single, .maybeSingle, implicit await).
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock('@/lib/billing-engine', () => ({
  billingEngine: {
    createInvoice: vi.fn(async (data: { member_id: string }) => ({
      id: `invoice-${data.member_id}`,
      invoice_number: `INV-FAKE-${data.member_id}`,
    })),
  },
}));

// Now safe to import the service under test
import { seasonBillingService } from '@/lib/billing/season-billing.service';

// ─── Test data factories ─────────────────────────────────────────────────────

const CLUB_ID = '11111111-1111-1111-1111-111111111111';
const SEASON_ID = '22222222-2222-2222-2222-222222222222';
const M1 = 'm1-uuid-0000-0000-0000-000000000001';
const M2 = 'm2-uuid-0000-0000-0000-000000000002';

/** Standard mock data: getSeasonClubId → season row, idempotency → empty. */
const SEASON_ROW = {
  id: SEASON_ID,
  name: 'Sommer 2026',
  club_id: CLUB_ID,
  start_date: '2026-06-01',
  end_date: '2026-08-31',
};

const BASE_PREVIEW = {
  seasonId: SEASON_ID,
  seasonName: 'Sommer 2026',
  config: {
    id: 'cfg-1',
    season_id: SEASON_ID,
    club_id: CLUB_ID,
    trainer_hourly_rate: 50,
    use_trainer_profile_rate: false,
    include_membership_fee: false,
    membership_fee_amount: null,
    membership_fee_type: 'yearly',
    payment_terms_days: 30,
    invoice_notes: null,
    tax_rate: 19,
    cost_split_method: 'per_participant',
    additional_fees: [],
  },
  groupBreakdown: [],
  totalTrainingCost: 150,
  totalMembershipFees: 0,
  totalAdditionalFees: 0,
  subtotalAmount: 150,
  totalTaxAmount: 28.5,
  grandTotal: 178.5,
  memberCount: 2,
  groupCount: 1,
};

const MEMBERS = [
  {
    memberId: M1,
    memberName: 'Alice',
    groupName: 'Gruppe A',
    trainingCost: 75,
    membershipFee: 0,
    additionalFees: 0,
    subtotalAmount: 75,
    taxAmount: 14.25,
    totalAmount: 89.25,
    lineItems: [
      {
        description: 'Training Gruppe A (Sommer 2026)',
        quantity: 1,
        unitPrice: 75,
        taxRate: 19,
        totalPrice: 75,
        taxPrice: 14.25,
        itemType: 'training_fee',
      },
    ],
  },
  {
    memberId: M2,
    memberName: 'Bob',
    groupName: 'Gruppe A',
    trainingCost: 75,
    membershipFee: 0,
    additionalFees: 0,
    subtotalAmount: 75,
    taxAmount: 14.25,
    totalAmount: 89.25,
    lineItems: [
      {
        description: 'Training Gruppe A (Sommer 2026)',
        quantity: 1,
        unitPrice: 75,
        taxRate: 19,
        totalPrice: 75,
        taxPrice: 14.25,
        itemType: 'training_fee',
      },
    ],
  },
];

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('SeasonBillingService.generateInvoices — atomic RPC path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the atomic RPC with the correct payload when the function is available', async () => {
    // Mock calculatePreview's underlying queries — first fetch is the season,
    // then billing config (or not, we use the auto-default path).
    let fromCall = 0;
    mockFrom.mockImplementation(() => {
      fromCall += 1;
      // 1: seasons 2: season_billing_configs 3: season_plan_entries
      // 4: trainers 5: groups 6: users 7: invoices (idempotency)
      if (fromCall === 1) {
        return makeChainable({
          data: {
            id: SEASON_ID,
            name: 'Sommer 2026',
            club_id: CLUB_ID,
            start_date: '2026-06-01',
            end_date: '2026-08-31',
          },
          error: null,
        });
      }
      if (fromCall === 7) {
        return makeChainable({ data: [], error: null });
      }
      return makeChainable({ data: [], error: null });
    });

    // Mock the RPC to return success
    mockRpc.mockResolvedValueOnce({
      data: {
        created: [
          {
            member_id: M1,
            invoice_id: 'inv-1',
            invoice_number: 'INV-AAA-2026-00001',
            total_amount: 89.25,
          },
          {
            member_id: M2,
            invoice_id: 'inv-2',
            invoice_number: 'INV-AAA-2026-00002',
            total_amount: 89.25,
          },
        ],
        skipped: [],
        failed: [],
      },
      error: null,
    });

    // Inject the preview via reflection (mock calculatePreview)
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: typeof MEMBERS }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      memberPreviews: MEMBERS,
    });

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    // RPC was called exactly once with the right name + payload
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'generate_season_invoices_atomic',
      expect.objectContaining({
        p_season_id: SEASON_ID,
        p_club_id: CLUB_ID,
        p_invoices: expect.arrayContaining([
          expect.objectContaining({
            member_id: M1,
            due_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            items: expect.arrayContaining([expect.objectContaining({ item_type: 'training_fee' })]),
          }),
        ]),
      })
    );

    // Result shape is correct
    expect(result.created).toHaveLength(2);
    expect(result.created[0]).toEqual({
      memberId: M1,
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-AAA-2026-00001',
      totalAmount: 89.25,
    });
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('falls back to the legacy per-invoice loop when the RPC returns 42883 (function not found)', async () => {
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: typeof MEMBERS }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      memberPreviews: MEMBERS,
    });

    let fromCall = 0;
    mockFrom.mockImplementation(() => {
      fromCall += 1;
      // 1: getSeasonClubId → season row with club_id
      // 2: idempotency check → empty
      // 3-4: billingEngine.createInvoice → supabase.from('invoices').insert + items
      if (fromCall === 1) {
        return makeChainable({ data: SEASON_ROW, error: null });
      }
      // For invoice + item inserts, return a synthetic row
      return makeChainable({
        data: { id: 'synth-inv', invoice_number: 'SYNTH-1' },
        error: null,
      });
    });

    // RPC returns the PostgREST "function not found" code
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    const { billingEngine } = await import('@/lib/billing-engine');
    const createSpy = vi.spyOn(billingEngine, 'createInvoice');

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    // RPC was attempted
    expect(mockRpc).toHaveBeenCalledWith('generate_season_invoices_atomic', expect.anything());

    // Fallback was used: billingEngine.createInvoice was called for each member
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ member_id: M1, type: 'season' })
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ member_id: M2, type: 'season' })
    );

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('falls back when the RPC throws an exception (network / DB error)', async () => {
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: typeof MEMBERS }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      memberPreviews: MEMBERS,
    });

    let fromCall = 0;
    mockFrom.mockImplementation(() => {
      fromCall += 1;
      if (fromCall === 1) {
        // getSeasonClubId → season row
        return makeChainable({ data: SEASON_ROW, error: null });
      }
      // idempotency + invoice/items inserts in the fallback path
      return makeChainable({ data: { id: 'synth-inv' }, error: null });
    });

    // RPC throws (e.g. transport error)
    mockRpc.mockRejectedValueOnce(new Error('connection refused'));

    const { billingEngine } = await import('@/lib/billing-engine');
    const createSpy = vi.spyOn(billingEngine, 'createInvoice');

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    expect(createSpy).toHaveBeenCalledTimes(2); // fallback ran
    expect(result.created).toHaveLength(2);
  });

  it('returns empty result when there are no member previews (no RPC call)', async () => {
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: unknown[] }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      memberPreviews: [],
      grandTotal: 0, // no members → no totals
    });

    // No mockFrom needed: the service early-returns BEFORE calling
    // getSeasonClubId when memberPreviews is empty.

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.previewGrandTotal).toBe(0);
  });

  it('propagates per-member failures from the RPC into the failed[] array', async () => {
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: typeof MEMBERS }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      memberPreviews: MEMBERS,
    });

    let fromCall = 0;
    mockFrom.mockImplementation(() => {
      fromCall += 1;
      if (fromCall === 1) {
        return makeChainable({ data: SEASON_ROW, error: null });
      }
      return makeChainable({ data: [], error: null });
    });

    mockRpc.mockResolvedValueOnce({
      data: {
        created: [
          {
            member_id: M1,
            invoice_id: 'inv-1',
            invoice_number: 'INV-AAA-2026-00001',
            total_amount: 89.25,
          },
        ],
        skipped: [],
        failed: [{ member_id: M2, error: 'duplicate invoice_number' }],
      },
      error: null,
    });

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].memberId).toBe(M1);
    expect(result.failed).toEqual([{ memberId: M2, error: 'duplicate invoice_number' }]);
  });

  it('logs rounding drift when preview grandTotal differs from sum of created totals by >= 1 ct', async () => {
    const svc = seasonBillingService as unknown as {
      calculatePreview: () => Promise<typeof BASE_PREVIEW & { memberPreviews: typeof MEMBERS }>;
    };
    vi.spyOn(svc, 'calculatePreview').mockResolvedValue({
      ...BASE_PREVIEW,
      grandTotal: 178.5,
      memberPreviews: MEMBERS,
    });

    let fromCall = 0;
    mockFrom.mockImplementation(() => {
      fromCall += 1;
      if (fromCall === 1) {
        return makeChainable({ data: SEASON_ROW, error: null });
      }
      return makeChainable({ data: [], error: null });
    });

    // RPC returns slightly different totals (simulating a rounding edge case)
    mockRpc.mockResolvedValueOnce({
      data: {
        created: [
          {
            member_id: M1,
            invoice_id: 'inv-1',
            invoice_number: 'INV-AAA-2026-00001',
            total_amount: 89.24, // off by 1 ct
          },
          {
            member_id: M2,
            invoice_id: 'inv-2',
            invoice_number: 'INV-AAA-2026-00002',
            total_amount: 89.24,
          },
        ],
        skipped: [],
        failed: [],
      },
      error: null,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await seasonBillingService.generateInvoices(SEASON_ID);

    expect(result.roundingDrift).toBeCloseTo(0.02, 2); // 178.5 - 178.48
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SeasonBilling] Rounding drift detected'),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });
});
