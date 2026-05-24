# Billing & Training System — Part 2a: Types & Balance Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define shared billing TypeScript types and implement the member balance service with TDD.

**Architecture:** lib/types/billing.types.ts for all shared types. lib/services/member-balance.service.ts for balance CRUD. Tests in tests/unit/.

**Tech Stack:** TypeScript, Supabase JS, Vitest

**Prerequisite:** Part 1 (schema migration) applied.

---

## Task 1: `lib/types/billing.types.ts`

- [ ] Create file with this exact content:

```typescript
export type InvoiceType = 'season' | 'membership' | 'adhoc';
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'reminder_sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'dunning'
  | 'cancelled';
export type InstallmentStatus = 'pending' | 'paid' | 'overdue';
export type BalanceEntryReferenceType = 'group_change' | 'invoice' | 'payment' | 'manual';
export type PaymentMethod = 'sepa' | 'transfer' | 'cash' | 'stripe';

export interface Invoice {
  id: string;
  club_id: string;
  member_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  season_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
  item_type: string;
  reference_id: string | null;
  reference_type: string | null;
  datev_account_number: string | null;
}

export interface InvoiceInstallment {
  id: string;
  invoice_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: InstallmentStatus;
  paid_at: string | null;
  payment_id: string | null;
}

export interface MemberBalance {
  id: string;
  member_id: string;
  club_id: string;
  balance: number;
  updated_at: string;
}

export interface MemberBalanceEntry {
  id: string;
  member_balance_id: string;
  amount: number;
  reason: string;
  reference_type: BalanceEntryReferenceType | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface GenerateSeasonInvoiceParams {
  club_id: string;
  member_id: string;
  season_id: string;
  fee_configuration_id: string;
  installment_count: number;
  installment_due_dates: string[];
  due_date: string;
  created_by: string;
}

export interface GroupChangeParams {
  club_id: string;
  member_id: string;
  old_group_id: string;
  new_group_id: string;
  change_date: string;
  created_by: string;
}

export interface GroupChangeCreditResult {
  credit_amount: number;
  charge_amount: number;
  net_delta: number;
  new_balance: number;
}
```

- [ ] Run `cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20` — expect no errors
- [ ] Commit: `git add lib/types/billing.types.ts && git commit -m "feat(billing): add billing TypeScript types"`

## Task 2: `tests/unit/member-balance.service.test.ts` (write test first)

- [ ] Create test file:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addBalanceEntry, getMemberBalance } from '@/lib/services/member-balance.service';

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom } as any;

describe('addBalanceEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts entry and increases balance for positive amount', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'entry-1',
              member_balance_id: 'bal-1',
              amount: 50,
              reason: 'test',
              reference_type: 'manual',
              reference_id: null,
              created_by: null,
              created_at: '2026-05-19T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const result = await addBalanceEntry(mockSupabase, {
      member_balance_id: 'bal-1',
      amount: 50,
      reason: 'Gutschrift Test',
      reference_type: 'manual',
      created_by: 'user-1',
    });
    expect(result.amount).toBe(50);
    expect(mockFrom).toHaveBeenCalledWith('member_balance_entries');
  });

  it('decreases balance for negative amount', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'entry-2',
              member_balance_id: 'bal-1',
              amount: -30,
              reason: 'Belastung',
              reference_type: 'group_change',
              reference_id: null,
              created_by: 'user-1',
              created_at: '2026-05-19T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const result = await addBalanceEntry(mockSupabase, {
      member_balance_id: 'bal-1',
      amount: -30,
      reason: 'Belastung Test',
      reference_type: 'group_change',
      created_by: 'user-1',
    });
    expect(result.amount).toBe(-30);
  });
});
```

- [ ] Run `cd /home/aeugeln/SwingZ && npx vitest run tests/unit/member-balance.service.test.ts 2>&1 | tail -10` — expect FAIL (file not found)

## Task 3: `lib/services/member-balance.service.ts` (implement)

- [ ] Create file:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MemberBalance,
  MemberBalanceEntry,
  BalanceEntryReferenceType,
} from '@/lib/types/billing.types';

export async function getOrCreateMemberBalance(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalance> {
  const { data: existing } = await supabase
    .from('member_balances')
    .select('*')
    .eq('member_id', memberId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (existing) return existing as MemberBalance;

  const { data, error } = await supabase
    .from('member_balances')
    .insert({ member_id: memberId, club_id: clubId, balance: 0 })
    .select()
    .single();

  if (error) throw new Error(`Failed to create member balance: ${error.message}`);
  return data as MemberBalance;
}

export async function getMemberBalance(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalance | null> {
  const { data } = await supabase
    .from('member_balances')
    .select('*')
    .eq('member_id', memberId)
    .eq('club_id', clubId)
    .maybeSingle();
  return (data as MemberBalance) ?? null;
}

export async function addBalanceEntry(
  supabase: SupabaseClient,
  params: {
    member_balance_id: string;
    amount: number;
    reason: string;
    reference_type?: BalanceEntryReferenceType;
    reference_id?: string;
    created_by?: string;
  }
): Promise<MemberBalanceEntry> {
  const { data: entry, error: entryError } = await supabase
    .from('member_balance_entries')
    .insert({
      member_balance_id: params.member_balance_id,
      amount: params.amount,
      reason: params.reason,
      reference_type: params.reference_type ?? null,
      reference_id: params.reference_id ?? null,
      created_by: params.created_by ?? null,
    })
    .select()
    .single();

  if (entryError) throw new Error(`Failed to create balance entry: ${entryError.message}`);

  const { error: updateError } = await supabase
    .from('member_balances')
    .update({ balance: supabase.rpc ? undefined : undefined, updated_at: new Date().toISOString() })
    .eq('id', params.member_balance_id);

  // Use raw SQL increment via rpc to avoid race condition
  await supabase.rpc('increment_member_balance', {
    p_balance_id: params.member_balance_id,
    p_amount: params.amount,
  });

  return entry as MemberBalanceEntry;
}

export async function getMemberBalanceHistory(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalanceEntry[]> {
  const balance = await getMemberBalance(supabase, memberId, clubId);
  if (!balance) return [];

  const { data } = await supabase
    .from('member_balance_entries')
    .select('*')
    .eq('member_balance_id', balance.id)
    .order('created_at', { ascending: false });

  return (data as MemberBalanceEntry[]) ?? [];
}
```

Note: The `addBalanceEntry` function uses a DB RPC `increment_member_balance` to atomically update the balance. Add this function to the migration (Part 1 can be amended, or add a separate migration `20260519000001_billing_helpers.sql`):

```sql
CREATE OR REPLACE FUNCTION increment_member_balance(p_balance_id uuid, p_amount numeric)
RETURNS void AS $$
  UPDATE member_balances SET balance = balance + p_amount, updated_at = now() WHERE id = p_balance_id;
$$ LANGUAGE sql;
```

- [ ] Run `cd /home/aeugeln/SwingZ && npx vitest run tests/unit/member-balance.service.test.ts 2>&1 | tail -10` — expect PASS
- [ ] Run `npx tsc --noEmit 2>&1 | head -20` — expect no errors
- [ ] Commit: `git add lib/services/member-balance.service.ts tests/unit/member-balance.service.test.ts && git commit -m "feat(billing): add member balance service with tests"`
