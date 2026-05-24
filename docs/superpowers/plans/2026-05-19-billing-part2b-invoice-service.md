# Billing & Training System — Part 2b: Invoice & Group Change Services

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement invoice generation service and group-change credit calculation service.

**Architecture:** lib/services/billing.service.ts for invoice creation. lib/services/group-change.service.ts for group change credits. Both import types from lib/types/billing.types.ts (Part 2a).

**Tech Stack:** TypeScript, Supabase JS, Vitest

**Prerequisites:** Part 1 (schema), Part 2a (types + balance service).

---

## Task 1: `lib/services/billing.service.ts`

- [ ] Create file with these functions:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Invoice, InvoiceItem, GenerateSeasonInvoiceParams } from '@/lib/types/billing.types';

export async function generateInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invoice_number', { p_club_id: clubId });
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return data as string;
}

export async function createAdhocInvoice(params: {
  club_id: string;
  member_id: string;
  due_date: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
  created_by: string;
}): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);
  const subtotal = params.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const { data: club } = await supabase
    .from('clubs')
    .select('tax_rate')
    .eq('id', params.club_id)
    .single();
  const taxRate = (club as any)?.tax_rate ?? 0;
  const tax_amount = subtotal * (taxRate / 100);
  const total_amount = subtotal + tax_amount;

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'adhoc',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal,
      tax_amount,
      total_amount,
      paid_amount: 0,
      currency: 'EUR',
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (invError) throw new Error(`Failed to create invoice: ${invError.message}`);

  const items = params.items.map((i) => ({
    invoice_id: (invoice as any).id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    tax_rate: taxRate,
    total_price: i.quantity * i.unit_price,
    item_type: 'other',
  }));
  await supabase.from('invoice_items').insert(items);

  return invoice as Invoice;
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'draft');
  if (error) throw new Error(`Failed to send invoice: ${error.message}`);
}

export async function createMembershipInvoice(params: {
  club_id: string;
  member_id: string;
  season_id: string;
  amount: number;
  due_date: string;
  created_by: string;
}): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);
  const { data: club } = await supabase
    .from('clubs')
    .select('tax_rate')
    .eq('id', params.club_id)
    .single();
  const taxRate = (club as any)?.tax_rate ?? 0;
  const tax_amount = params.amount * (taxRate / 100);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'membership',
      season_id: params.season_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal: params.amount,
      tax_amount,
      total_amount: params.amount + tax_amount,
      paid_amount: 0,
      currency: 'EUR',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Invoice;
}
```

- [ ] Run `cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `git add lib/services/billing.service.ts && git commit -m "feat(billing): add invoice generation service"`

## Task 2: `lib/services/group-change.service.ts`

- [ ] Create file:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { GroupChangeParams, GroupChangeCreditResult } from '@/lib/types/billing.types';
import { getOrCreateMemberBalance, addBalanceEntry } from './member-balance.service';

export async function processGroupChange(
  params: GroupChangeParams
): Promise<GroupChangeCreditResult> {
  const supabase = await createClient();

  const { data: oldSessions } = await supabase
    .from('sessions')
    .select('id, timeslot_start, timeslot_end')
    .contains('group_ids', [params.old_group_id])
    .gt('timeslot_start', params.change_date)
    .not('status', 'in', '("holiday_cancelled","cancelled")');

  const { data: newSessions } = await supabase
    .from('sessions')
    .select('id, timeslot_start, timeslot_end')
    .contains('group_ids', [params.new_group_id])
    .gt('timeslot_start', params.change_date)
    .not('status', 'in', '("holiday_cancelled","cancelled")');

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('fee_configuration_id, fee_configurations(amount, billing_unit_count)')
    .eq('user_id', params.member_id)
    .eq('club_id', params.club_id)
    .eq('is_active', true)
    .maybeSingle();

  const { data: club } = await supabase
    .from('clubs')
    .select('billing_unit_minutes')
    .eq('id', params.club_id)
    .single();

  const billingUnitMinutes = (club as any)?.billing_unit_minutes ?? 60;
  const feeConfig = (membership as any)?.fee_configurations;
  const pricePerUnit = feeConfig?.amount ?? 0;
  const billingUnitsPerSession = feeConfig?.billing_unit_count ?? 1;

  const calcAmount = (sessions: any[]) =>
    (sessions?.length ?? 0) * pricePerUnit * billingUnitsPerSession;

  const credit_amount = calcAmount(oldSessions ?? []);
  const charge_amount = calcAmount(newSessions ?? []);
  const net_delta = credit_amount - charge_amount;

  await supabase
    .from('training_group_memberships')
    .update({ left_at: params.change_date, left_reason: 'group_change' })
    .eq('member_id', params.member_id)
    .eq('training_group_id', params.old_group_id)
    .is('left_at', null);

  await supabase.from('training_group_memberships').insert({
    training_group_id: params.new_group_id,
    member_id: params.member_id,
    club_id: params.club_id,
    joined_at: params.change_date,
    created_by: params.created_by,
  });

  const balance = await getOrCreateMemberBalance(supabase, params.member_id, params.club_id);

  if (credit_amount > 0) {
    await addBalanceEntry(supabase, {
      member_balance_id: balance.id,
      amount: credit_amount,
      reason: `Gutschrift Gruppenwechsel (${params.old_group_id} → ${params.new_group_id})`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }
  if (charge_amount > 0) {
    await addBalanceEntry(supabase, {
      member_balance_id: balance.id,
      amount: -charge_amount,
      reason: `Belastung Gruppenwechsel (→ ${params.new_group_id})`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }

  const new_balance = balance.balance + net_delta;
  return { credit_amount, charge_amount, net_delta, new_balance };
}
```

- [ ] Run `cd /home/aeugeln/SwingZ && npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `git add lib/services/group-change.service.ts && git commit -m "feat(billing): add group change credit service"`

## Task 3: Helper migration for `increment_member_balance` RPC

- [ ] Create `supabase/migrations/20260519000001_billing_helpers.sql`:

```sql
CREATE OR REPLACE FUNCTION increment_member_balance(p_balance_id uuid, p_amount numeric)
RETURNS void AS $$
  UPDATE member_balances
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_balance_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

- [ ] Commit: `git add supabase/migrations/20260519000001_billing_helpers.sql && git commit -m "feat(billing): add increment_member_balance RPC helper"`
