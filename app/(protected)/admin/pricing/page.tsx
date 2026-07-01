import { requireAdminClub } from '@/lib/admin-context';
import { PricingClient } from './pricing-client';

export const metadata = {
  title: 'Dynamische Preisgestaltung – SwingZ',
  description: 'Zeitbasierte Preise, Saison-Aufschläge und Tagespreise für Plätze verwalten',
};

export default async function PricingPage() {
  const { clubId } = await requireAdminClub();

  return <PricingClient clubId={clubId} />;
}
