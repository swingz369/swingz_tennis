import { Sparkles } from 'lucide-react';

export default function Loading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-pulse">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand-primary" />
          Probetrainings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deine Probetraining-Anfragen und Termine
        </p>
      </div>

      {/* Skeleton cards */}
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border dark:border-white/10 bg-card p-5 space-y-4"
        >
          {/* Status badge + date */}
          <div className="flex items-start justify-between">
            <div className="h-5 w-20 rounded-full bg-muted dark:bg-white/10" />
            <div className="h-3 w-32 rounded bg-muted dark:bg-white/10" />
          </div>

          {/* Description */}
          <div className="h-4 w-3/4 rounded bg-muted dark:bg-white/10" />

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-muted dark:bg-white/10 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 w-10 rounded bg-muted dark:bg-white/10" />
                  <div className="h-3.5 w-28 rounded bg-muted dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>

          {/* Trainer */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted dark:bg-white/10" />
            <div className="h-3.5 w-36 rounded bg-muted dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
