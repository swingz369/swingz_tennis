export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-muted rounded mb-2" />
        <div className="h-4 w-72 bg-muted rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border dark:border-white/10 bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
            <div className="h-3 w-56 bg-muted rounded" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-24 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
