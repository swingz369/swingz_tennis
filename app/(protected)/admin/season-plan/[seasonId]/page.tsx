import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { Skeleton } from '@/components/ui/skeleton';

const SeasonPlanGridClient = dynamicImport(
  () => import('./season-plan-grid-client').then((m) => m.SeasonPlanGridClient),
  {
    loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
  }
);

export const dynamic = 'force-dynamic';

export default async function SeasonPlanGridPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { seasonId } = await params;

  // Fetch season
  const { data: season } = await supabase
    .from('seasons')
    .select('id, club_id, name, season_type, year')
    .eq('id', seasonId)
    .single();

  if (!season) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Saison nicht gefunden</h2>
          <p className="text-sm text-gray-500 mt-2">Die angeforderte Saison existiert nicht.</p>
        </div>
      </div>
    );
  }

  // Check access
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
    <SeasonPlanGridClient seasonId={seasonId} seasonName={season.name} clubId={season.club_id} />
  );
}
