import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getMemberBalance, getMemberBalanceHistory } from '@/lib/services/member-balance.service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  const { supabase, user } = auth;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const clubId = searchParams.get('clubId');
  if (!memberId || !clubId)
    return NextResponse.json({ error: 'memberId und clubId erforderlich' }, { status: 400 });

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
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
  }

  const balance = await getMemberBalance(supabase, memberId, clubId);
  const entries = balance ? await getMemberBalanceHistory(supabase, memberId, clubId) : [];
  return NextResponse.json({ data: { balance, entries } });
}
