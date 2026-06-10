import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { PlanListClient } from './plan-list-client';

export const dynamic = 'force-dynamic';

export default async function SeasonPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: season } = await supabase
    .from('seasons')
    .select('id, club_id, name, season_type, year, planning_status, start_date, end_date')
    .eq('id', seasonId)
    .single();

  if (!season) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Saison nicht gefunden</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Die angeforderte Saison existiert nicht.
          </p>
        </div>
      </div>
    );
  }

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const hasAccess = memberships?.some(
    (m) => (m.role === 'superadmin' || m.role === 'admin') && m.club_id === season.club_id
  );

  if (!hasAccess) {
    redirect('/admin/seasons');
  }

  return (
    <PlanListClient
      seasonId={season.id}
      seasonName={season.name}
      planningStatus={season.planning_status}
    />
  );
}
