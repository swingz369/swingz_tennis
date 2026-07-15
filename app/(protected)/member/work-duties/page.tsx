import { requireAuth } from '@/lib/auth';
import WorkDutiesMemberClient from './work-duties-member-client';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = {
  title: 'Meine Arbeitsdienste — SwingZ',
};

export default async function MemberWorkDutiesPage() {
  const { supabase, user } = await requireAuth();

  // Get club membership
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  const clubId = memberships?.[0]?.club_id;

  if (!clubId) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">Kein Verein zugeordnet.</p>
      </div>
    );
  }

  // Check if work_duty feature is enabled for this club
  const { data: club } = await supabase.from('clubs').select('features').eq('id', clubId).single();

  const features = (club?.features as Record<string, boolean>) ?? {};
  if (features.work_duty === false) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">
          Das Arbeitsdienst-Feature ist für diesen Verein nicht aktiviert.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Arbeitsdienste" description="Deine Dienste und verfügbare Einsätze" />
      <WorkDutiesMemberClient userId={user.id} />
    </div>
  );
}
