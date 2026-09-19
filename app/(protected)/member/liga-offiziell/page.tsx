import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { TennisdeWidget } from '@/components/tennisde-widget';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Offizieller Spielplan | SwingZ',
};

/** /member/liga-offiziell — tennis.de-Widget mit Mannschaften, Spielplan und Tabellen des Vereins. */
export default async function MemberOfficialLeaguePage() {
  const { supabase, user } = await requireAuth();
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);
  const clubId = memberships?.[0]?.club_id ?? null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Offizieller Spielplan"
        description="Mannschaften, Spielplan und Tabellen deines Vereins von tennis.de"
        back={{ href: '/member/leagues', label: 'Meine Mannschaften' }}
      />
      <TennisdeWidget clubId={clubId} />
    </div>
  );
}
