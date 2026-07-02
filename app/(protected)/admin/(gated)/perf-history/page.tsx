import { requireAdminClub } from '@/lib/admin-context';
import { PerfHistoryClient } from '@/components/admin/perf-history-client';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Performance-Verlauf',
  description: 'Benchmark-Verlauf der Saisonplanung (lokal & CI)',
};

export default async function PerfHistoryPage() {
  // Admin guard — throws/redirects if not authorized
  await requireAdminClub();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Performance-Verlauf"
        description="Benchmark-Ergebnisse der Saisonplanung — lokal ausgeführt oder aus GitHub-Actions-Pipelines (nightly perf-bench)."
        breadcrumbs={[{ label: 'Performance-Verlauf' }]}
      />

      <PerfHistoryClient />
    </div>
  );
}
