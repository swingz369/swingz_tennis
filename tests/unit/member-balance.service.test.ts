import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure logic — mock supabase entirely
const mockRpc = vi.fn();

const mockFrom = vi.fn();
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
} as any;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { getMemberBalance, addBalanceEntry } from '@/lib/services/member-balance.service';

describe('getMemberBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no balance record exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    const result = await getMemberBalance(mockSupabase, 'member-1', 'club-1');
    expect(result).toBeNull();
  });

  it('returns balance when record exists', async () => {
    const balance = {
      id: 'bal-1',
      member_id: 'member-1',
      club_id: 'club-1',
      balance: 50,
      updated_at: '2026-05-19T00:00:00Z',
    };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: balance, error: null }),
          }),
        }),
      }),
    });
    const result = await getMemberBalance(mockSupabase, 'member-1', 'club-1');
    expect(result).toEqual(balance);
    expect(result?.balance).toBe(50);
  });
});

describe('addBalanceEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts entry and calls rpc to increment balance for positive amount', async () => {
    const entry = {
      id: 'entry-1',
      member_balance_id: 'bal-1',
      amount: 50,
      reason: 'Gutschrift',
      reference_type: 'manual',
      reference_id: null,
      created_by: 'user-1',
      created_at: '2026-05-19T00:00:00Z',
    };
    mockRpc.mockResolvedValue({ data: [entry], error: null });

    const result = await addBalanceEntry(mockSupabase, {
      member_balance_id: 'bal-1',
      amount: 50,
      reason: 'Gutschrift',
      reference_type: 'manual',
      created_by: 'user-1',
    });

    expect(result.amount).toBe(50);
    expect(mockRpc).toHaveBeenCalledWith('add_balance_entry_atomic', {
      p_balance_id: 'bal-1',
      p_amount: 50,
      p_reason: 'Gutschrift',
      p_reference_type: 'manual',
      p_reference_id: null,
      p_created_by: 'user-1',
    });
  });

  it('passes negative amount for debit entries', async () => {
    const entry = {
      id: 'entry-2',
      member_balance_id: 'bal-1',
      amount: -30,
      reason: 'Belastung',
      reference_type: 'group_change',
      reference_id: null,
      created_by: 'user-1',
      created_at: '2026-05-19T00:00:00Z',
    };
    mockRpc.mockResolvedValue({ data: [entry], error: null });

    const result = await addBalanceEntry(mockSupabase, {
      member_balance_id: 'bal-1',
      amount: -30,
      reason: 'Belastung',
      reference_type: 'group_change',
      created_by: 'user-1',
    });

    expect(result.amount).toBe(-30);
    expect(mockRpc).toHaveBeenCalledWith('add_balance_entry_atomic', {
      p_balance_id: 'bal-1',
      p_amount: -30,
      p_reason: 'Belastung',
      p_reference_type: 'group_change',
      p_reference_id: null,
      p_created_by: 'user-1',
    });
  });

  it('throws when insert fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(
      addBalanceEntry(mockSupabase, {
        member_balance_id: 'bal-1',
        amount: 10,
        reason: 'test',
      })
    ).rejects.toThrow('Failed to create balance entry');
  });
});
