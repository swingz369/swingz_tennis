import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getMemberBalance, getMemberBalanceHistory } from '@/lib/services/member-balance.service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, user } = auth;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const clubId = searchParams.get('clubId');
  if (!memberId || !clubId)
    return NextResponse.json({ error: 'memberId and clubId required' }, { status: 400 });

  const isSelf = memberId === user.id;
  if (!isSelf) {
    const { data: membership } = await (supabase as any)
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle();
    if (!membership || !['admin', 'superadmin'].includes(membership.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const balance = await getMemberBalance(supabase as any, memberId, clubId);
  const entries = balance ? await getMemberBalanceHistory(supabase as any, memberId, clubId) : [];
  return NextResponse.json({ data: { balance, entries } });
}
