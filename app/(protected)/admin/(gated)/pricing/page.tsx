import { requireAdminClub } from '@/lib/admin-context';
import { PricingClient } from './pricing-client';

export const metadata = {
  title: 'Dynamische Preisgestaltung – SwingZ',
  description: 'Zeitbasierte Preise, Saison-Aufschläge und Tagespreise für Plätze verwalten',
};

export default async function PricingPage() {
  const { supabase, clubId } = await requireAdminClub();

  const { data: club } = await supabase.from('clubs').select('features').eq('id', clubId).single();
  const features = (club?.features as Record<string, boolean>) ?? {};
  if (features.dynamic_pricing !== true) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">
          Das Modul „Dynamische Preisgestaltung" ist für diesen Verein nicht aktiviert.
        </p>
      </div>
    );
  }

  return <PricingClient clubId={clubId} />;
}
