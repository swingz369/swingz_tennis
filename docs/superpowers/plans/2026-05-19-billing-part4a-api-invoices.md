# Billing & Training System — Part 4a: Invoice API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REST API routes for invoice CRUD operations.

**Architecture:** Next.js App Router routes under app/api/billing/. requireAuth() for auth, Zod for validation.

**Tech Stack:** Next.js 15, TypeScript, Zod, Supabase SSR

**Prerequisites:** Parts 1–2b completed.

---

## Task 1: `app/api/billing/invoices/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createAdhocInvoice } from '@/lib/services/billing.service';

const CreateSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(255),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
      })
    )
    .min(1),
});

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth();
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let query = supabase
    .from('invoices')
    .select('*, invoice_items(*), invoice_installments(*)')
    .eq('club_id', clubId);
  const type = searchParams.get('type');
  if (type) query = query.eq('invoice_type', type);
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);
  const memberId = searchParams.get('memberId');
  if (memberId) query = query.eq('member_id', memberId);

  const { data, error } = await query.order('invoice_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth();
  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const invoice = await createAdhocInvoice({ ...parsed.data, created_by: user.id });
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
```

- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add invoices list and create API route`

## Task 2: `app/api/billing/invoices/[id]/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

const UpdateSchema = z.object({
  status: z.enum(['sent', 'cancelled', 'overdue', 'reminder_sent']),
  cancellation_reason: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireAuth();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*), invoice_installments(*)')
    .eq('id', params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', data.club_id)
    .eq('is_active', true)
    .maybeSingle();
  const isMember = data.member_id === user.id;
  if (!membership && !isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireAuth();
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: invoice } = await supabase
    .from('invoices')
    .select('club_id, status')
    .eq('id', params.id)
    .single();
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', invoice.club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === 'sent') updates.sent_at = new Date().toISOString();
  if (parsed.data.status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
    updates.cancellation_reason = parsed.data.cancellation_reason ?? null;
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add invoice detail and status update route`

## Task 3: `app/api/billing/installments/[id]/route.ts`

- [ ] Create file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

const MarkPaidSchema = z.object({
  payment_method: z.enum(['sepa', 'transfer', 'cash', 'stripe']),
  paid_at: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireAuth();
  const body = await request.json();
  const parsed = MarkPaidSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: installment } = await supabase
    .from('invoice_installments')
    .select('*, invoices(club_id, member_id, total_amount)')
    .eq('id', params.id)
    .single();
  if (!installment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const clubId = (installment as any).invoices?.club_id;
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const paidAt = parsed.data.paid_at ?? new Date().toISOString();

  // Mark installment paid
  await supabase
    .from('invoice_installments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', params.id);

  // Check if all installments paid → update invoice
  const { data: remaining } = await supabase
    .from('invoice_installments')
    .select('status')
    .eq('invoice_id', installment.invoice_id)
    .neq('status', 'paid');
  if (!remaining?.length) {
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: paidAt,
        paid_amount: (installment as any).invoices?.total_amount,
      })
      .eq('id', installment.invoice_id);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add installment payment route`
