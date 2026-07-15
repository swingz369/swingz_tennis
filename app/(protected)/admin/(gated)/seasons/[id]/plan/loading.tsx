export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-muted rounded" />
        <div>
          <div className="h-7 w-56 bg-muted rounded mb-2" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>

      {/* Plan entries */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl border border-border dark:border-white/10 bg-card"
          >
            <div className="h-10 w-10 bg-muted rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-64 bg-muted rounded" />
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
