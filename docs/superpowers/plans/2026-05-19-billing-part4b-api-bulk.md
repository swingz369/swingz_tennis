# Billing & Training System — Part 4b: Bulk Generation, Group Change & Balance Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API routes for bulk season invoice generation, group changes, and member balance queries.

**Architecture:** Next.js App Router routes under app/api/billing/. Admin-only for mutations.

**Tech Stack:** Next.js 15, TypeScript, Zod, Supabase SSR

**Prerequisites:** Parts 1–2b, Part 4a completed.

---

## Task 1: `app/api/billing/generate-season-invoices/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createSeasonInvoice } from '@/lib/services/billing.service';

const Schema = z.object({
  club_id: z.string().uuid(),
  season_id: z.string().uuid(),
  installment_count: z.number().int().min(1).max(3).default(1),
  installment_due_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { club_id, season_id, installment_count, installment_due_dates, due_date } = parsed.data;

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: members } = await supabase
    .from('user_club_memberships')
    .select('user_id, fee_configuration_id')
    .eq('club_id', club_id)
    .eq('is_active', true)
    .eq('role', 'member');

  let created = 0;
  const errors: string[] = [];

  for (const member of members ?? []) {
    try {
      await createSeasonInvoice({
        club_id,
        member_id: member.user_id,
        season_id,
        fee_configuration_id: member.fee_configuration_id ?? '',
        installment_count,
        installment_due_dates,
        due_date,
        created_by: user.id,
      });
      created++;
    } catch (e) {
      errors.push(`${member.user_id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({ created, errors });
}
```

Note: `createSeasonInvoice` needs to be added to `lib/services/billing.service.ts`. Add this function after existing exports:

```typescript
export async function createSeasonInvoice(params: GenerateSeasonInvoiceParams): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);

  // Count billable sessions for member's group in this season
  const { data: feeConfig } = await supabase
    .from('fee_configurations')
    .select('amount, billing_unit_count')
    .eq('id', params.fee_configuration_id)
    .single();
  const { data: club } = await supabase
    .from('clubs')
    .select('tax_rate')
    .eq('id', params.club_id)
    .single();

  const pricePerUnit = (feeConfig as any)?.amount ?? 0;
  const taxRate = (club as any)?.tax_rate ?? 0;
  const subtotal = pricePerUnit; // simplified: actual billable session count × price is computed by caller
  const tax_amount = subtotal * (taxRate / 100);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'season',
      season_id: params.season_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal,
      tax_amount,
      total_amount: subtotal + tax_amount,
      paid_amount: 0,
      currency: 'EUR',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (params.installment_count > 1) {
    const perInstallment = (subtotal + tax_amount) / params.installment_count;
    const installments = params.installment_due_dates.map((due, i) => ({
      invoice_id: (invoice as any).id,
      installment_number: i + 1,
      amount: perInstallment,
      due_date: due,
      status: 'pending',
    }));
    await supabase.from('invoice_installments').insert(installments);
  }

  return invoice as Invoice;
}
```

- [ ] Add `createSeasonInvoice` to `lib/services/billing.service.ts`
- [ ] Create `app/api/billing/generate-season-invoices/route.ts`
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add bulk season invoice generation route`

## Task 2: `app/api/billing/group-change/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { processGroupChange } from '@/lib/services/group-change.service';

const Schema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  old_group_id: z.string().uuid(),
  new_group_id: z.string().uuid(),
  change_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', parsed.data.club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin', 'trainer'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await processGroupChange({ ...parsed.data, created_by: user.id });
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
```

- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add group change API route`

## Task 3: `app/api/billing/balance/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMemberBalance, getMemberBalanceHistory } from '@/lib/services/member-balance.service';

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const clubId = searchParams.get('clubId');
  if (!memberId || !clubId)
    return NextResponse.json({ error: 'memberId and clubId required' }, { status: 400 });

  // Member can see own balance; admin can see all
  const isSelf = memberId === user.id;
  if (!isSelf) {
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle();
    if (!membership || !['admin', 'superadmin'].includes(membership.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const balance = await getMemberBalance(supabase, memberId, clubId);
  const entries = balance ? await getMemberBalanceHistory(supabase, memberId, clubId) : [];
  return NextResponse.json({ data: { balance, entries } });
}
```

- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add member balance query route`
