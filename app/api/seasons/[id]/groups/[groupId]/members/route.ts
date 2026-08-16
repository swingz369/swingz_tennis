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
  const { id: seasonId, groupId } = await context.params;
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });

  // Wer in einer Saison-Gruppe ist, steht in `season_plan_entries.expected_participants`
  // — daran hängen Abrechnung, Buchungen und die Mitglieder-Ansicht. Die frühere
  // Quelle `training_group_memberships` hat in dieser Datenbank keine einzige
  // Zeile; die Liste blieb deshalb immer leer.
  const { data: entries, error } = await (auth.supabase as any)
    .from('season_plan_entries')
    .select('expected_participants')
    .eq('season_id', seasonId)
    .eq('club_id', clubId)
    .eq('group_id', groupId);
  if (error) return internalErrorResponse();

  const memberIds: string[] = [
    ...new Set<string>(
      (entries ?? []).flatMap((e: any) =>
        Array.isArray(e.expected_participants) ? (e.expected_participants as string[]) : []
      )
    ),
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
