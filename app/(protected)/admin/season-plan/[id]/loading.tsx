export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded" />
          <div>
            <div className="h-7 w-56 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded-lg" />
          <div className="h-9 w-28 bg-muted rounded-lg" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="rounded-xl border border-border dark:border-white/10 bg-card overflow-hidden">
        {/* Grid header row */}
        <div className="grid grid-cols-8 border-b border-border dark:border-white/10 bg-muted/50">
          <div className="p-3">
            <div className="h-4 w-14 bg-muted rounded" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-3 text-center">
              <div className="h-4 w-8 bg-muted rounded mx-auto" />
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-8 border-b border-border/30 dark:border-white/[0.02]"
          >
            <div className="p-2">
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="p-2 min-h-[48px]">
                {(row + col) % 3 === 0 && <div className="h-8 w-full bg-muted rounded" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
