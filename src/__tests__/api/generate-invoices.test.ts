/**
 * Unit tests for POST /api/billing/generate-invoices
 *
 * Tests idempotency (skip already billed members), month-aware messages,
 * fee configuration handling, error paths, and invoice creation logic.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS
// ════════════════════════════════════════════════════════════

const CLUB_ID = 'club-001';
const USER_ID = 'user-admin-001';

// ════════════════════════════════════════════════════════════
// MOCK STATE
// ════════════════════════════════════════════════════════════

let mockVerifyRole: any;

const mockAuthCtx = {
  user: { id: USER_ID, email: 'admin@test.com' },
  clubId: CLUB_ID,
  role: 'admin',
  supabase: {
    from: vi.fn(),
  } as any,
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  verifyRole: (...args: unknown[]) => mockVerifyRole(...args),
  forbiddenResponse: (msg?: string) =>
    new Response(JSON.stringify({ error: msg || 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { STRICT: { max: 5, windowMs: 60000 } },
  checkRateLimitOrFail: vi.fn().mockResolvedValue(null),
}));

// ════════════════════════════════════════════════════════════
// CHAIN HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Creates a Supabase thenable chain for select queries.
 * The chain resolves via .then() with { data, error }.
 * Methods return `this` for fluent chaining.
 */
function selectChain(data: unknown | null, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

/**
 * Creates a chain for count queries: .select('id', { count: 'exact', head: true })
 * Resolves with { count }.
 */
function countChain(count: number | null, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => {
    resolve({ data: null, count, error });
    return chain;
  };
  return chain;
}

/**
 * Creates a chain for insert queries: .insert(...).select(...)
 * Resolves with { data }.
 */
function insertChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => {
    resolve({ data, error });
    return chain;
  };
  return chain;
}

/**
 * Creates a chain for insert without .select() (invoice_items).
 * Resolves with { error }.
 */
function insertNoSelectChain(error: { message: string } | null = null) {
  const chain: Record<string, any> = {};
  chain.insert = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => {
    resolve({ error });
    return chain;
  };
  return chain;
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/billing/generate-invoices', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/billing/generate-invoices/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockReset();
    mockAuthCtx.role = 'admin';
    mockAuthCtx.clubId = CLUB_ID;
  });

  // ── Helper: set up all Supabase chains for a typical invoice generation ──

  function setupGenerateMocks(opts: {
    memberships?: unknown[];
    membershipsError?: { message: string } | null;
    feeConfig?: unknown | null;
    feeError?: { message: string } | null;
    existingInvoices?: unknown[];
    invoiceCount?: number | null;
    clubTaxRate?: number | null;
    insertedInvoices?: unknown[];
    insertError?: { message: string } | null;
    lineItemError?: { message: string } | null;
  }) {
    const {
      memberships = [],
      membershipsError = null,
      feeConfig = null,
      feeError = null,
      existingInvoices = [],
      invoiceCount = 0,
      clubTaxRate = 0,
      insertedInvoices = [],
      insertError = null,
      lineItemError = null,
    } = opts;

    let insertChainCount = 0;

    (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      switch (table) {
        case 'user_club_memberships':
          return selectChain(memberships, membershipsError);
        case 'fee_configurations':
          return selectChain(feeConfig, feeError);
        case 'clubs':
          return selectChain(clubTaxRate !== null ? { tax_rate: clubTaxRate } : null);
        case 'invoices': {
          // Distinguish: existing invoices query vs. insert
          // First call is the existing-invoices select
          // Second call is the count query (select with head:true)
          // Subsequent calls are insert chains
          const fromCalls = (mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>).mock.calls;
          const callsForInvoices = fromCalls.filter((c) => c[0] === 'invoices').length;

          if (callsForInvoices === 1) {
            // First call: existing invoices query
            return selectChain(existingInvoices);
          }
          if (callsForInvoices === 2) {
            // Second call: count query
            return countChain(invoiceCount);
          }
          // Subsequent calls: insert
          insertChainCount++;
          return insertChain(insertedInvoices, insertError);
        }
        case 'invoice_items':
          return insertNoSelectChain(lineItemError);
        default:
          return selectChain([]);
      }
    });
  }

  // ── Auth / validation ──────────────────────────────────────────────────

  it('returns 403 when user is not admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Zugriff nur für Admins');
  });

  it('returns 400 when no club context is available', async () => {
    (mockAuthCtx as any).clubId = null;
    mockAuthCtx.role = 'admin';

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('clubId erforderlich');
  });

  it('returns 400 for invalid month format', async () => {
    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 'not-a-month' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Ungültiges Monatsformat');
  });

  it('returns 400 for month=13 (out of range)', async () => {
    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-13' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Ungültiges Monatsformat');
  });

  // ── Empty / no members ─────────────────────────────────────────────────

  it('returns NO_FEE_CONFIGURED when club has no members (API returns early before checking memberships)', async () => {
    setupGenerateMocks({ memberships: [] });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.warning).toBe('NO_FEE_CONFIGURED');
    expect(body.message).toContain('Keine Gebühr konfiguriert');
  });

  // ── Idempotency: all members already billed ────────────────────────────

  it('returns informative message when all members are skipped', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-a', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Beitrag' },
      existingInvoices: [{ member_id: 'user-a' }],
      invoiceCount: 5,
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.message).toContain('Alle 1 Mitglieder wurden bereits');
    expect(body.message).toContain('Juni 2026');
  });

  // ── Invoice line items ────────────────────────────────────────────────

  it('creates invoice_items when feeAmount > 0', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Jahresbeitrag' },
      existingInvoices: [],
      invoiceCount: 5,
      insertedInvoices: [{ id: 'inv-new', member_id: 'user-x' }],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    await POST(req);

    // invoice_items.insert should have been called
    const fromMock = mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>;
    expect(fromMock).toHaveBeenCalledWith('invoice_items');
  });

  it('returns warning when feeAmount is 0 — no invoices created, no invoice_items', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: null as unknown as string,
      existingInvoices: [],
      invoiceCount: 5,
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(memberships.length); // memberships count, not 0
    expect(body.warning).toBe('NO_FEE_CONFIGURED');
    expect(body.message).toContain('Keine Gebühr konfiguriert');
    expect(body.message).toContain('wurden NICHT erstellt');
    expect(body.message).toContain('Juni 2026');

    // invoice_items.insert should NOT be called (early return)
    const fromMock = mockAuthCtx.supabase.from as ReturnType<typeof vi.fn>;
    expect(fromMock).not.toHaveBeenCalledWith('invoice_items');
    // invoices.insert should NOT be called (early return)
    // Already verified by created=0
  });

  // ── Null invoiceCount fallback ────────────────────────────────────────

  it('falls back to 0 when invoiceCount is null', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 30, currency: 'EUR', name: 'Beitrag' },
      existingInvoices: [],
      invoiceCount: null, // count query returns null
      insertedInvoices: [{ id: 'inv-1', member_id: 'user-x' }],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.skipped).toBe(0);
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  it('skips all members when they already have invoices for the month (idempotency)', async () => {
    const memberships = [
      { id: 'm1', user_id: 'user-a', club_id: CLUB_ID },
      { id: 'm2', user_id: 'user-b', club_id: CLUB_ID },
      { id: 'm3', user_id: 'user-c', club_id: CLUB_ID },
    ];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Jahresbeitrag' },
      existingInvoices: [{ member_id: 'user-a' }, { member_id: 'user-b' }, { member_id: 'user-c' }],
      invoiceCount: 10,
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.skipped).toBe(3);
    expect(body.month).toBe('2026-06');
    // New month-aware message
    expect(body.message).toContain('Alle 3 Mitglieder wurden bereits');
    expect(body.message).toContain('Juni 2026');
  });

  // ── Partial: some created, some skipped ────────────────────────────────

  it('creates invoices for unbilled members and skips already billed ones', async () => {
    const memberships = [
      { id: 'm1', user_id: 'user-a', club_id: CLUB_ID },
      { id: 'm2', user_id: 'user-b', club_id: CLUB_ID },
      { id: 'm3', user_id: 'user-c', club_id: CLUB_ID },
    ];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Jahresbeitrag' },
      // Only user-a already billed
      existingInvoices: [{ member_id: 'user-a' }],
      invoiceCount: 10,
      insertedInvoices: [
        { id: 'inv-new-1', member_id: 'user-b' },
        { id: 'inv-new-2', member_id: 'user-c' },
      ],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.created).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.month).toBe('2026-06');
    // Partial message
    expect(body.message).toContain('2 Rechnung(en) für Juni 2026 erstellt');
    expect(body.message).toContain('1 bereits vorhanden');
  });

  // ── All created, none skipped ──────────────────────────────────────────

  it('creates invoices for all members when none are pre-billed', async () => {
    const memberships = [
      { id: 'm1', user_id: 'user-a', club_id: CLUB_ID },
      { id: 'm2', user_id: 'user-b', club_id: CLUB_ID },
    ];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Jahresbeitrag' },
      existingInvoices: [], // none pre-billed
      invoiceCount: 5,
      insertedInvoices: [
        { id: 'inv-new-1', member_id: 'user-a' },
        { id: 'inv-new-2', member_id: 'user-b' },
      ],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-07' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.created).toBe(2);
    expect(body.skipped).toBe(0);
    // Clean message without "bereits vorhanden"
    expect(body.message).toBe('2 Rechnung(en) für Juli 2026 erstellt');
  });

  // ── Month handling ─────────────────────────────────────────────────────

  it('uses the month from the request body', async () => {
    setupGenerateMocks({
      memberships: [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }],
      feeConfig: { id: 'fee-1', amount: 30, currency: 'EUR', name: 'Beitrag' },
      existingInvoices: [],
      invoiceCount: 3,
      insertedInvoices: [{ id: 'inv-1', member_id: 'user-x' }],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-03' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe('2026-03');
    expect(body.message).toContain('März 2026');
  });

  it('creates invoices with correct invoice numbers and amounts', async () => {
    const memberships = [
      { id: 'm1', user_id: 'user-x', club_id: CLUB_ID },
      { id: 'm2', user_id: 'user-y', club_id: CLUB_ID },
    ];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Jahresbeitrag' },
      existingInvoices: [],
      invoiceCount: 10,
      clubTaxRate: 19,
      insertedInvoices: [
        { id: 'inv-1', member_id: 'user-x' },
        { id: 'inv-2', member_id: 'user-y' },
      ],
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(2);

    // Verify correct invoice numbers: INV-2026-06-0011, INV-2026-06-0012
    // (baseCount=10, so seqNum starts at 10 + 0 + 1 = 11)
    expect(body.message).toContain('2 Rechnung(en) für Juni 2026 erstellt');
  });

  // ── No fee config → early return with warning ───────────────────────────

  it('returns early with warning when no fee configuration exists (no €0 invoices)', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: null as unknown as string,
      existingInvoices: [],
      invoiceCount: 5,
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(memberships.length); // memberships count, not 0
    expect(body.warning).toBe('NO_FEE_CONFIGURED');
    expect(body.message).toContain('Keine Gebühr konfiguriert');
    expect(body.message).toContain('Juni 2026');
  });

  // ── DB errors ──────────────────────────────────────────────────────────

  it('returns 500 on memberships query error', async () => {
    setupGenerateMocks({
      membershipsError: { message: 'connection timeout' },
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('connection timeout');
  });

  it('returns 200 with NO_FEE_CONFIGURED on fee_configurations query error (maybeSingle returns null)', async () => {
    setupGenerateMocks({
      memberships: [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }],
      feeError: { message: 'table does not exist' },
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    // maybeSingle() swallows errors → feeAmount = 0 → early return with NO_FEE_CONFIGURED
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warning).toBe('NO_FEE_CONFIGURED');
    expect(body.created).toBe(0);
  });

  it('returns 500 on invoice insert error', async () => {
    setupGenerateMocks({
      memberships: [{ id: 'm1', user_id: 'user-x', club_id: CLUB_ID }],
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Beitrag' },
      existingInvoices: [],
      invoiceCount: 5,
      insertError: { message: 'duplicate key violation' },
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('duplicate key');
  });

  // ── Idempotency with mixed member_id null case ─────────────────────────

  it('ignores null member_ids in existing invoices (filtered by .filter(Boolean))', async () => {
    const memberships = [{ id: 'm1', user_id: 'user-a', club_id: CLUB_ID }];

    setupGenerateMocks({
      memberships,
      feeConfig: { id: 'fee-1', amount: 49.99, currency: 'EUR', name: 'Beitrag' },
      // Existing invoice has null member_id → should not block
      existingInvoices: [{ member_id: null }, { member_id: 'user-a' }],
      invoiceCount: 5,
      // user-a IS blocked by the non-null entry, so 0 new
    });

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-06' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    // user-a was found in existing → skipped
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
  });

  // ── Superadmin club resolution ─────────────────────────────────────────

  it('superadmin without clubId cookie returns 400', async () => {
    mockAuthCtx.role = 'superadmin';
    (mockAuthCtx as any).clubId = null;

    const req = new NextRequest('http://localhost/api/billing/generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('clubId erforderlich');
  });
});
