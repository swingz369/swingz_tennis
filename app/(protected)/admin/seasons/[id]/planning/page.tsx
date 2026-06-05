import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { PlanningWizardClient } from './planning-wizard-client';

export const dynamic = 'force-dynamic';

export default async function PlanningWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id: seasonId } = await params;

  // Fetch season to get clubId
  const { data: season } = await supabase
    .from('seasons')
    .select('id, club_id, name, season_type, year, planning_status')
    .eq('id', seasonId)
    .single();

  if (!season) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground dark:text-white">
            Saison nicht gefunden
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Die angeforderte Saison existiert nicht.
          </p>
        </div>
      </div>
    );
  }

  // Check access: user must be admin/superadmin of this club
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
    <PlanningWizardClient
      seasonId={seasonId}
      clubId={season.club_id}
      seasonName={season.name}
      seasonType={season.season_type}
      seasonYear={season.year}
      planningStatus={season.planning_status}
    />
  );
}
