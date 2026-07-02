export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-muted rounded" />
        <div>
          <div className="h-7 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted rounded-lg" />
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl border border-border dark:border-white/10"
            >
              <div className="h-9 w-9 bg-muted rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="h-6 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border dark:border-white/10 bg-card p-5 space-y-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
