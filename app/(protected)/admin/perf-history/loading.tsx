export default function Loading() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-52 bg-muted rounded mb-2" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>

      {/* Chart area */}
      <div className="rounded-xl border border-border dark:border-white/10 bg-card p-6">
        <div className="h-5 w-40 bg-muted rounded mb-6" />
        <div className="h-64 w-full bg-muted rounded" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border dark:border-white/10 bg-card overflow-hidden">
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="h-5 w-48 bg-muted rounded" />
        </div>
        <div className="divide-y divide-border/30 dark:divide-white/[0.02]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="flex-1 h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
