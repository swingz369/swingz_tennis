import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { createAdhocInvoice } from '@/lib/services/billing.service';

const CreateSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1).max(255),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
  })).min(1),
});

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let query = (supabase as any)
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
  const { user } = await requireAuth(request);
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
