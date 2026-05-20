import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';

const UpdateSchema = z.object({
  status: z.enum(['sent', 'cancelled', 'overdue', 'reminder_sent']),
  cancellation_reason: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAuth(request);

  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*, invoice_items(*), invoice_installments(*)')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await (supabase as any)
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAuth(request);
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: invoice, error: fetchErr } = await (supabase as any)
    .from('invoices')
    .select('club_id, status')
    .eq('id', id)
    .single();
  if (fetchErr || !invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await (supabase as any)
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

  const { data: updated, error: updateErr } = await (supabase as any)
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ data: updated });
}
