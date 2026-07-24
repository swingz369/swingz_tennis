import { Card } from '@/components/ui/card';

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="bordered" className="p-6">
            <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
            <div className="h-64 bg-muted rounded-xl border border-border" />
          </Card>
        ))}
      </div>
    </div>
  );
}
