export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-40 bg-muted rounded mb-2" />
        <div className="h-4 w-72 bg-muted rounded" />
      </div>

      {/* Member stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border dark:border-white/10 bg-card p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-muted rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
            <div className="h-2 w-full bg-muted rounded-full" />
          </div>
        ))}
      </div>

      {/* Assignments table */}
      <div className="rounded-xl border border-border dark:border-white/10 bg-card overflow-hidden">
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="h-5 w-32 bg-muted rounded" />
        </div>
        <div className="divide-y divide-border/30 dark:divide-white/[0.02]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="h-4 w-4 bg-muted rounded shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-36 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="h-5 w-20 bg-muted rounded-full" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
