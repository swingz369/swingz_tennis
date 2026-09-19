import { requireAdminClub } from '@/lib/admin-context';
import { PageHeader } from '@/components/ui/page-header';
import { TennisdeWidget } from '@/components/tennisde-widget';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Offizieller Spielplan | SwingZ',
};

/** /admin/leagues/offiziell — tennis.de-Widget mit Mannschaften, Spielplan und Tabellen des Vereins. */
export default async function AdminOfficialLeaguePage() {
  const { clubId } = await requireAdminClub();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Offizieller Spielplan"
        description="Mannschaften, Spielplan und Tabellen deines Vereins von tennis.de"
        back={{ href: '/admin/leagues', label: 'Liga & Mannschaft' }}
      />
      <TennisdeWidget clubId={clubId} settingsHref="/admin/settings" />
    </div>
  );
}
