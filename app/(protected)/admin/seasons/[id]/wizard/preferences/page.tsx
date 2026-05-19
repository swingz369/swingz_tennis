import { notFound } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { PreferencesForm } from './preferences-form';

export default async function PreferencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await supabase
    .from('seasons')
    .select('id, preferences_deadline, preferences_open, auto_plan_config')
    .eq('id', id)
    .single();
  if (!season) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">
          Lege den Rahmen fest bevor Mitglieder Präferenzen abgeben.
        </p>
      </div>
      <PreferencesForm seasonId={id} season={season} />
    </div>
  );
}
