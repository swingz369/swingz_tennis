import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthContext } from '@/lib/api-auth';
import { SeasonBillingService } from '@/application/services/season-billing.service';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockFrom = vi.fn();

const mockAuth = {
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
  user: { id: 'admin-uid' },
  clubId: '11111111-1111-1111-1111-111111111111',
  role: 'admin',
  memberships: [],
} as unknown as AuthContext;

// ─── Test data factories ─────────────────────────────────────────────────────

const CLUB_ID = '11111111-1111-1111-1111-111111111111';
const SEASON_ID = '22222222-2222-2222-2222-222222222222';
const M1 = 'm1-uuid-0000-0000-0000-000000000001';
const M2 = 'm2-uuid-0000-0000-0000-000000000002';

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
    membership_fee_type: 'yearly' as const,
    payment_terms_days: 30,
    invoice_notes: null,
    tax_rate: 19,
    cost_split_method: 'per_participant' as const,
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

/**
 * Mock Supabase query builder. Unlike a plain chainable stub, it tracks
 * whether `.insert()` was called on it and resolves to a different result
 * in that case — needed because `SeasonBillingRepository.createInvoice`
 * reuses the same `.from('invoices')` table for both the idempotency
 * SELECT and (in the legacy-loop fallback) the invoice INSERT.
 */
function makeQueryBuilder(opts: {
  select?: { data: unknown; error: unknown };
  insert?: (rows: unknown) => { data: unknown; error: unknown };
}) {
  const builder: Record<string, unknown> = {};
  let didInsert = false;
  let insertedRows: unknown = null;

  for (const key of [
    'select',
    'eq',
    'in',
    'single',
    'maybeSingle',
    'limit',
    'order',
    'neq',
    'gte',
    'lte',
    'filter',
  ]) {
    builder[key] = () => builder;
  }
  builder.insert = (rows: unknown) => {
    didInsert = true;
    insertedRows = rows;
    return builder;
  };
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (didInsert && opts.insert) {
      resolve(opts.insert(insertedRows));
    } else {
      resolve(opts.select ?? { data: null, error: null });
    }
    return builder;
  };
  return builder;
}

function mockDefaultTables() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'seasons') return makeQueryBuilder({ select: { data: SEASON_ROW, error: null } });
    return makeQueryBuilder({ select: { data: [], error: null } });
  });
}

/** Additionally wires `invoices`/`invoice_items` INSERT for the legacy loop. */
function mockLegacyLoopTables() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'seasons') return makeQueryBuilder({ select: { data: SEASON_ROW, error: null } });
    if (table === 'invoices') {
      return makeQueryBuilder({
        select: { data: [], error: null }, // idempotency check: none existing
        insert: (rows) => {
          const row = rows as { member_id: string };
          return {
            data: {
              id: `legacy-inv-${row.member_id}`,
              invoice_number: `INV-LEGACY-${row.member_id}`,
            },
            error: null,
          };
        },
      });
    }
    if (table === 'invoice_items') {
      return makeQueryBuilder({ insert: () => ({ data: null, error: null }) });
    }
    return makeQueryBuilder({ select: { data: [], error: null } });
  });
}

function spyOnPreview(memberPreviews: typeof MEMBERS, overrides: Record<string, unknown> = {}) {
  return vi
    .spyOn(SeasonBillingService.prototype, 'calculatePreview')
    .mockResolvedValue({ ...BASE_PREVIEW, memberPreviews, ...overrides } as never);
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('SeasonBillingService.generateInvoices — atomic RPC path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('calls the atomic RPC with the correct payload when the function is available', async () => {
    mockDefaultTables();
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
    spyOnPreview(MEMBERS);

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

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
    mockLegacyLoopTables();
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });
    spyOnPreview(MEMBERS);

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

    expect(mockRpc).toHaveBeenCalledWith('generate_season_invoices_atomic', expect.anything());
    expect(result.created).toHaveLength(2);
    expect(result.created.map((c) => c.memberId).sort()).toEqual([M1, M2].sort());
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('falls back when the RPC throws an exception (network / DB error)', async () => {
    mockLegacyLoopTables();
    mockRpc.mockRejectedValueOnce(new Error('connection refused'));
    spyOnPreview(MEMBERS);

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

    expect(result.created).toHaveLength(2); // fallback ran
  });

  it('returns empty result when there are no member previews (no RPC call)', async () => {
    mockDefaultTables();
    spyOnPreview([], { grandTotal: 0 });

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.previewGrandTotal).toBe(0);
  });

  it('propagates per-member failures from the RPC into the failed[] array', async () => {
    mockDefaultTables();
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
    spyOnPreview(MEMBERS);

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].memberId).toBe(M1);
    expect(result.failed).toEqual([{ memberId: M2, error: 'duplicate invoice_number' }]);
  });

  it('logs rounding drift when preview grandTotal differs from sum of created totals by >= 1 ct', async () => {
    mockDefaultTables();
    mockRpc.mockResolvedValueOnce({
      data: {
        created: [
          {
            member_id: M1,
            invoice_id: 'inv-1',
            invoice_number: 'INV-AAA-2026-00001',
            total_amount: 89.24,
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
    spyOnPreview(MEMBERS, { grandTotal: 178.5 });

    // createLogger() routes through console.log under jsdom (this project's
    // global test environment) since logger.ts's isServer check is false there.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await new SeasonBillingService(mockAuth).generateInvoices(SEASON_ID);

    expect(result.roundingDrift).toBeCloseTo(0.02, 1); // 178.5 - 178.48
    expect(logSpy).toHaveBeenCalledWith(
      '[WARN]',
      expect.stringContaining('Rounding drift detected'),
      expect.anything()
    );
  });
});
