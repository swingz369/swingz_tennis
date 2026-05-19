import { notFound } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { KanbanBoard } from './kanban-board';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await (supabase as any)
    .from('seasons')
    .select('id, club_id')
    .eq('id', id)
    .single();
  if (!season) notFound();

  const [{ data: groups }, { data: memberships }] = await Promise.all([
    (supabase as any)
      .from('groups')
      .select('id, name, level, member_ids')
      .eq('club_id', season.club_id)
      .eq('is_active', true),
    (supabase as any)
      .from('user_club_memberships')
      .select('user_id, users!inner(id, full_name, skill_level)')
      .eq('club_id', season.club_id)
      .eq('role', 'member')
      .eq('is_active', true),
  ]);

  const members = (memberships ?? []).map(
    (m: {
      user_id: string;
      users: { id: string; full_name: string | null; skill_level: string | null };
    }) => ({
      id: m.users.id,
      full_name: m.users.full_name ?? m.user_id,
      skill_level: m.users.skill_level ?? 'beginner',
    })
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plan</h1>
        <p className="text-muted-foreground">
          Mitglieder per Drag &amp; Drop auf Gruppen verteilen.
        </p>
      </div>
      <KanbanBoard
        seasonId={id}
        clubId={season.club_id}
        groups={groups ?? []}
        allMembers={members}
      />
    </div>
  );
}
