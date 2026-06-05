export default function ClubDashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-xl bg-background dark:bg-card">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Menu Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col p-6 border rounded-xl bg-background dark:bg-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
