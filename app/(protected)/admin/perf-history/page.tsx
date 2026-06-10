import { requireAdminClub } from '@/lib/admin-context';
import { PerfHistoryClient } from '@/components/admin/perf-history-client';

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
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Performance-Verlauf</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Benchmark-Ergebnisse der Saisonplanung — lokal ausgeführt oder aus
          GitHub-Actions-Pipelines (nightly perf-bench).
        </p>
      </div>

      <PerfHistoryClient />
    </div>
  );
}
