import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { requireAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string; groupId: string }>;
}

// GET /api/seasons/[id]/groups/[groupId]/members – aktive Mitglieder der Gruppe
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  const { groupId } = await context.params;
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });

  const { data: memberships, error } = await (auth.supabase as any)
    .from('training_group_memberships')
    .select('member_id')
    .eq('training_group_id', groupId)
    .eq('club_id', clubId)
    .is('left_at', null);
  if (error) return internalErrorResponse();

  const memberIds: string[] = [
    ...new Set<string>((memberships ?? []).map((m: any) => m.member_id as string)),
  ];
  if (memberIds.length === 0) return NextResponse.json({ members: [] });

  const { data: users, error: uErr } = await (auth.supabase as any)
    .from('users')
    .select('id, full_name, email')
    .in('id', memberIds);
  if (uErr) return internalErrorResponse();

  const members = (users ?? []).map((u: any) => ({
    id: u.id as string,
    name: (u.full_name as string) || (u.email as string) || 'Unbekannt',
  }));
  members.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de'));

  return NextResponse.json({ members });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  const { groupId } = await context.params;
  const { member_ids } = await request.json();
  if (!Array.isArray(member_ids))
    return NextResponse.json({ error: 'member_ids muss ein Array sein' }, { status: 400 });
  const { data, error } = await (auth.supabase as any)
    .from('groups')
    .update({ member_ids, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select('id, member_ids')
    .single();
  if (error) return internalErrorResponse();
  return NextResponse.json(data);
}
