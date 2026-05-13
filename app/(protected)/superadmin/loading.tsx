import { Card, CardContent } from '@/components/ui/card';

export default function SuperadminLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Platform KPIs Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-300 rounded animate-pulse" />
                </div>
                <div className="h-10 w-10 bg-gray-200 rounded-xl animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clubs List Skeleton */}
      <Card>
        <div className="p-6">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Quick Actions Skeleton */}
      <div>
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5"
            >
              <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse shrink-0" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
