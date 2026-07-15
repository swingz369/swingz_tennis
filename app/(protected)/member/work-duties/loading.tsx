export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-44 bg-muted rounded mb-2" />
        <div className="h-4 w-56 bg-muted rounded" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border dark:border-white/10 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-6 w-10 bg-muted rounded" />
              </div>
              <div className="h-8 w-8 bg-muted rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Duty cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border dark:border-white/10 bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-56 bg-muted rounded" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
