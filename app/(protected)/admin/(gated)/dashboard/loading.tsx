import { Card } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      {/* KPI Cards Skeleton — 5-col asymmetric grid with 2-1-1-1 layout
          (matches the dashboard's Featured KPI that spans 2 cols and the
          three secondary KPIs that span 1 each). Mirrors the layout in
          `app/(protected)/admin/(gated)/page.tsx` so loading state and
          final state never produce a visual jump when widgets settle.
          Mobile: single-column stack on phones < 640px to avoid crowding;
          the dashboard page itself goes straight to 2-col because there
          is no transition guard for skeleton placeholder widths. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" className={`p-6 ${i === 0 ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
            </div>
          </Card>
        ))}
      </div>

      {/* Clubs List Skeleton */}
      <Card variant="bordered">
        <div className="p-6">
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl bg-muted dark:bg-card/5"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-9 w-9 bg-muted rounded-xl animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
