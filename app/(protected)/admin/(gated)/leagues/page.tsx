import LeaguesClient from './leagues-client';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = {
  title: 'Liga & Mannschaft | SwingZ',
};

export default function LeaguesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Liga & Mannschaft"
        description="Mannschaftsaufstellung, Liga-Verwaltung und Spieltag-Planung"
      />
      <LeaguesClient />
    </div>
  );
}
