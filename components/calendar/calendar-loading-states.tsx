'use client';

/** Lade-Skeleton + Leerzustand (keine Plätze) des Platzkalenders —
 *  ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2). */
import { MapPin } from 'lucide-react';

export function CalendarLoadingSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-xl animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
      </div>
      <div className="h-12 bg-muted rounded-xl animate-pulse" />
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-8 bg-muted/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-muted/40 animate-pulse border-r border-border/20 last:border-r-0"
            />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, row) => (
          <div key={row} className="grid grid-cols-8 border-t border-border/20">
            {Array.from({ length: 8 }).map((_, col) => (
              <div
                key={col}
                className="h-40 bg-background border-r border-border/20 last:border-r-0 p-1.5"
              >
                <div className="space-y-1">
                  {Array.from({ length: 4 }).map((_, s) => (
                    <div key={s} className="h-5 bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NoCourtsEmptyState() {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MapPin className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-lg font-medium">Keine Plätze gefunden</p>
        <p className="text-sm">Fügen Sie über die Verwaltung Plätze hinzu.</p>
      </div>
    </div>
  );
}
