import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';

const MarkPaidSchema = z.object({
  payment_method: z.enum(['sepa', 'transfer', 'cash', 'stripe']),
  paid_at: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAuth(request);
  const body = await request.json();
  const parsed = MarkPaidSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: installment, error: fetchErr } = await (supabase as any)
    .from('invoice_installments')
    .select('*, invoices(club_id, member_id, total_amount)')
    .eq('id', id)
    .single();
  if (fetchErr || !installment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const clubId = installment.invoices?.club_id;
  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const paidAt = parsed.data.paid_at ?? new Date().toISOString();

  const { error: markErr } = await (supabase as any)
    .from('invoice_installments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', id);
  if (markErr) return NextResponse.json({ error: markErr.message }, { status: 500 });

  // Check if all installments paid
  const { data: remaining } = await (supabase as any)
    .from('invoice_installments')
    .select('status')
    .eq('invoice_id', installment.invoice_id)
    .neq('status', 'paid');

  if (!remaining?.length) {
    await (supabase as any)
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: paidAt,
        paid_amount: installment.invoices?.total_amount ?? 0,
      })
      .eq('id', installment.invoice_id);
  }

  return NextResponse.json({ success: true });
}
