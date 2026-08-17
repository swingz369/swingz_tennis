import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { requireAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  const { supabase } = auth;

  const { id: seasonId } = await context.params;
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });

  // Fetch distinct groups used in plan entries for this season
  const { data: entries, error } = await supabase
    .from('season_plan_entries')
    .select('group_id')
    .eq('season_id', seasonId)
    .eq('club_id', clubId)
    .not('group_id', 'is', null);

  if (error) return internalErrorResponse();

  const groupIds: string[] = [
    ...new Set<string>((entries ?? []).map((e: any) => e.group_id as string)),
  ];

  if (groupIds.length === 0) return NextResponse.json({ groups: [] });

  // `season_plan_entries.group_id` zeigt auf `groups` (die von der
  // Clustering-Engine erzeugten Saison-Gruppen), NICHT auf die alte Tabelle
  // `training_groups` (fixe Stundenpläne, `schedule_id NOT NULL`). Die stand
  // hier bis zum 16.08.2026 — sie ist leer, die Abfrage lieferte immer eine
  // leere Liste, und die Oberfläche schloss daraus "Bitte zuerst eine Planung
  // veröffentlichen", obwohl die Saison längst veröffentlicht war.
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, name, age_group, level')
    .in('id', groupIds)
    .eq('club_id', clubId)
    .eq('is_active', true);

  if (gErr) return internalErrorResponse();

  return NextResponse.json({ groups: groups ?? [] });
}
