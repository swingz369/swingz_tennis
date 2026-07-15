export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <div className="h-3.5 w-14 bg-muted rounded" />
        <div className="h-3.5 w-3.5 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>

      {/* Profile header */}
      <div className="rounded-xl border border-border dark:border-white/10 bg-card overflow-hidden">
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-muted rounded-full shrink-0" />
              <div className="space-y-1.5">
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-4 w-56 bg-muted rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-16 bg-muted rounded-full" />
              <div className="h-8 w-28 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 flex gap-6 border-b border-border dark:border-white/10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 w-16 bg-muted rounded pb-3" />
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-border dark:border-white/10 p-5 space-y-4">
            <div className="h-5 w-44 bg-muted rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-5 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
