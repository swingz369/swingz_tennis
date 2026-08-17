import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Supabase client ──
// CourtService creates the client at module scope via createServiceClient(),
// so we mock the module before importing CourtService.
//
// The two pagination methods use Promise.all with two queries:
//   1. Data query:  .select('*').eq(...).order(...).range(...) → returns { data, error }
//   2. Count query: .select('id', {count:'exact', head:true}).eq(...) → no .range()
//
// Since both queries share the same mock chain (from() returns the same object),
// we need the chain to be thenable so Promise.all can resolve the count query.
// The data query's .range() returns a plain { data, error } object (not thenable).
// The count query ends at the chain (thenable) → .then() resolves with { count }.

let mockRangeData: unknown[] = [];
let mockRangeCount: number | null = 0;
let mockRangeError: { message: string } | null = null;

type MockChain = {
  select: Mock;
  eq: Mock;
  order: Mock;
  range: Mock;
  then: Mock;
};

function makeChainable(): MockChain {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => ({ data: mockRangeData, error: mockRangeError }));
  // Make chain thenable — count queries don't call .range(), they end at the chain.
  // Promise.all checks for .then() and calls it to resolve the value.
  chain.then = vi.fn((resolve: (value: unknown) => void) => {
    resolve({ count: mockRangeCount });
    return chain;
  });
  return chain as unknown as MockChain;
}

let mockChain = makeChainable();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => mockChain),
  })),
}));

// Import AFTER mock is set up
const { CourtService } = await import('@/lib/booking/court.service');

const CLUB = '11111111-1111-1111-1111-111111111111';

describe('CourtService – Pagination Methods', () => {
  // `typeof CourtService` in InstanceType<> is invalid syntax for an abstract
  // class. `any` is fine here: the test only cares about behaviour, not types.
  let service: any;

  beforeEach(() => {
    // Reset the singleton so each test gets a fresh instance with the fresh mock
    (CourtService as unknown as { instance: typeof CourtService | undefined }).instance = undefined;
    mockChain = makeChainable();
    mockRangeData = [];
    mockRangeCount = 0;
    mockRangeError = null;
    service = CourtService.getInstance();
  });

  // ═══════════════════════════════════════════
  // getCourtTypesPaginated
  // ═══════════════════════════════════════════
  describe('getCourtTypesPaginated', () => {
    it('returns paginated active court types with correct offset', async () => {
      const fakeTypes = [
        { id: '1', name: 'Sandplatz', is_active: true },
        { id: '2', name: 'Hartplatz', is_active: true },
      ];
      mockRangeData = fakeTypes;
      mockRangeCount = 15;

      const result = await service.getCourtTypesPaginated(CLUB, 2, 10);

      expect(result.data).toEqual(fakeTypes);
      expect(result.count).toBe(15);

      // Data query: select('*').eq('is_active', true).order('name').range(10, 19)
      expect(mockChain.select).toHaveBeenNthCalledWith(1, '*');
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockChain.order).toHaveBeenCalledWith('name', { ascending: true });
      // Only the data query calls .range(); count query uses .then()
      expect(mockChain.range).toHaveBeenCalledOnce();
      expect(mockChain.range).toHaveBeenCalledWith(10, 19);
    });

    it('calculates offset correctly for page 1', async () => {
      mockRangeData = [{ id: '1', name: 'Rasen', is_active: true }];
      mockRangeCount = 1;

      const result = await service.getCourtTypesPaginated(CLUB, 1, 20);

      expect(mockChain.range).toHaveBeenCalledWith(0, 19);
      expect(result.count).toBe(1);
    });

    it('filters only active court types', async () => {
      mockRangeData = [];
      mockRangeCount = 0;

      await service.getCourtTypesPaginated(CLUB, 1, 10);

      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    });

    // Der Service läuft über den Service-Client und umgeht RLS — ohne diesen
    // Filter sieht jeder Verein die Platztypen aller anderen.
    it('scopes both queries to the club', async () => {
      mockRangeData = [];
      mockRangeCount = 0;

      await service.getCourtTypesPaginated(CLUB, 1, 10);

      expect(mockChain.eq).toHaveBeenCalledWith('club_id', CLUB);
      expect(mockChain.eq.mock.calls.filter((c: unknown[]) => c[0] === 'club_id')).toHaveLength(2);
    });

    it('returns empty data and count 0 when no results', async () => {
      mockRangeData = [];
      mockRangeCount = 0;

      const result = await service.getCourtTypesPaginated(CLUB, 1, 10);

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('returns count 0 when Supabase returns null count', async () => {
      mockRangeData = [];
      mockRangeCount = null;

      const result = await service.getCourtTypesPaginated(CLUB, 1, 10);

      expect(result.count).toBe(0);
    });

    it('throws when the data query fails', async () => {
      mockRangeError = { message: 'connection refused' };
      mockRangeData = [];
      mockRangeCount = 0;

      await expect(service.getCourtTypesPaginated(CLUB, 1, 10)).rejects.toThrow(
        'Failed to get court types: connection refused'
      );
    });
  });

  // ═══════════════════════════════════════════
  // getAllCourtTypesPaginated
  // ═══════════════════════════════════════════
  describe('getAllCourtTypesPaginated', () => {
    it('returns paginated court types (all, including inactive)', async () => {
      const fakeTypes = [
        { id: '1', name: 'Kunstrasen', is_active: true },
        { id: '2', name: 'Teppich', is_active: false },
      ];
      mockRangeData = fakeTypes;
      mockRangeCount = 42;

      const result = await service.getAllCourtTypesPaginated(CLUB, 3, 15);

      expect(result.data).toEqual(fakeTypes);
      expect(result.count).toBe(42);

      // Kein is_active-Filter (Admins sehen auch inaktive) — der club_id-Filter
      // muss trotzdem auf beiden Queries liegen.
      expect(mockChain.eq).not.toHaveBeenCalledWith('is_active', expect.anything());
      expect(mockChain.eq.mock.calls.filter((c: unknown[]) => c[0] === 'club_id')).toHaveLength(2);
      expect(mockChain.order).toHaveBeenCalledWith('name', { ascending: true });
      // offset = (3 - 1) * 15 = 30
      expect(mockChain.range).toHaveBeenCalledOnce();
      expect(mockChain.range).toHaveBeenCalledWith(30, 44);
    });

    it('does not filter by is_active (includes inactive)', async () => {
      mockRangeData = [];
      mockRangeCount = 0;

      await service.getAllCourtTypesPaginated(CLUB, 1, 10);

      // eq should NOT be called with 'is_active'
      const eqCalls = (mockChain.eq as ReturnType<typeof vi.fn>).mock.calls;
      const hasActiveFilter = eqCalls.some((call: unknown[]) => call[0] === 'is_active');
      expect(hasActiveFilter).toBe(false);
    });

    it('calculates offset correctly for page 1', async () => {
      mockRangeData = [];
      mockRangeCount = 0;

      const result = await service.getAllCourtTypesPaginated(CLUB, 1, 25);

      expect(mockChain.range).toHaveBeenCalledWith(0, 24);
      expect(result.count).toBe(0);
    });

    it('returns count 0 when Supabase returns null count', async () => {
      mockRangeData = [];
      mockRangeCount = null;

      const result = await service.getAllCourtTypesPaginated(CLUB, 1, 10);

      expect(result.count).toBe(0);
    });

    it('throws when the data query fails', async () => {
      mockRangeError = { message: 'timeout' };
      mockRangeData = [];
      mockRangeCount = 0;

      await expect(service.getAllCourtTypesPaginated(CLUB, 1, 10)).rejects.toThrow(
        'Failed to get court types: timeout'
      );
    });
  });

  // ═══════════════════════════════════════════
  // Singleton behaviour
  // ═══════════════════════════════════════════
  describe('getInstance', () => {
    it('returns the same instance on repeated calls', () => {
      const a = CourtService.getInstance();
      const b = CourtService.getInstance();
      expect(a).toBe(b);
    });
  });
});
