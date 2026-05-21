import { notFound } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { GroupsManager } from './groups-manager';

export default async function GroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', id)
    .single();
  if (!season) notFound();

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, level, age_group');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gruppen konfigurieren</h1>
        <p className="text-muted-foreground">Lege die Trainingsgruppen für diese Saison an.</p>
      </div>
      <GroupsManager seasonId={id} initialGroups={groups ?? []} />
    </div>
  );
}
