import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { createSeasonInvoice } from '@/lib/services/billing.service';

const Schema = z.object({
  club_id: z.string().uuid(),
  season_id: z.string().uuid(),
  installment_count: z.number().int().min(1).max(3).default(1),
  installment_due_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, user } = auth;

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { club_id, season_id, installment_count, installment_due_dates, due_date } = parsed.data;

  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: members } = await (supabase as any)
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
