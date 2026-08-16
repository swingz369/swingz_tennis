import { requireAuth } from '@/lib/auth';
import { PartnerFinderPanel } from '@/components/partner-finder-panel';
import { ScrollReveal } from '@/components/animations';
import { PageHeader } from '@/components/ui/page-header';

export default async function PartnerFinderPage() {
  const { supabase, user } = await requireAuth();

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  const clubId = memberships?.[0]?.club_id;
  if (clubId) {
    const { data: club } = await supabase
      .from('clubs')
      .select('features')
      .eq('id', clubId)
      .single();
    const features = (club?.features as Record<string, boolean>) ?? {};
    if (features.partner_finder !== true) {
      return (
        <p className="text-muted-foreground">
          Das Modul „Spielpartner-Suche" ist für diesen Verein nicht aktiviert.
        </p>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Algorithmus-basiert
        </p>
        <PageHeader
          title="Spielpartner-Suche"
          description="Finde Trainingspartner mit passendem Level und gemeinsamen Interessen"
        />
      </div>

      <ScrollReveal delay={100}>
        <PartnerFinderPanel />
      </ScrollReveal>
    </div>
  );
}
