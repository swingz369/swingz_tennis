import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, user } = auth;
  const clubId = new URL(request.url).searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await (supabase as any)
    .from('fee_configurations')
    .select('*')
    .eq('club_id', clubId)
    .in('type', ['training', 'membership'])
    .order('type')
    .order('name');
  if (error) return internalErrorResponse();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, user } = auth;
  const body = await request.json();
  const { club_id, name, type, amount, billing_cycle = 'yearly', billing_unit_count = 1 } = body;
  if (!club_id || !name || !type || amount === undefined)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await (supabase as any)
    .from('fee_configurations')
    .insert({ club_id, name, type, amount, billing_cycle, billing_unit_count, currency: 'EUR' })
    .select()
    .single();
  if (error) return internalErrorResponse();
  return NextResponse.json({ data }, { status: 201 });
}
