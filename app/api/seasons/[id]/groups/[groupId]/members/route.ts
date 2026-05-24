import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string; groupId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await context.params;
  const { member_ids } = await request.json();
  if (!Array.isArray(member_ids))
    return NextResponse.json({ error: 'member_ids must be an array' }, { status: 400 });
  const { data, error } = await (auth.supabase as any)
    .from('groups')
    .update({ member_ids, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select('id, member_ids')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
