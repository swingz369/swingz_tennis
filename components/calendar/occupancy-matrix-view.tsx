'use client';

/**
 * Belegungs-Übersicht: alle Plätze × Stunden eines Tages auf einen Blick.
 * Freie Zelle → Buchen, alles andere zeigt nur den Status (Details im Tag-/Agenda-Kalender).
 */
import { format, getDay } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from '@/hooks/use-sessions';
import { getSlotStatus, type CourtClosure, type SlotStatus } from '@/lib/court-calendar-utils';
import { DAILY_HOURS } from '@/components/calendar/calendar-primitives';
import type { PlanEntry } from '@/components/calendar/types';

const CELL: Record<SlotStatus, { label: string; className: string }> = {
  available: {
    label: 'Frei',
    className: 'bg-success-50 text-success-700 hover:bg-success-100 cursor-pointer',
  },
  session: { label: 'Training', className: 'bg-info-500 text-white' },
  plan: { label: 'Saisonplan', className: 'bg-warning-100 text-warning-800' },
  booked: { label: 'Belegt', className: 'bg-warning-500 text-white' },
  'own-booking': { label: 'Deine', className: 'bg-error-500 text-white' },
  blocked: { label: 'Gesperrt', className: 'bg-muted text-muted-foreground' },
};

export function OccupancyMatrixView({
  date,
  courts,
  sessions,
  closures,
  openingHours,
  getPlanEntriesForCourtAndDay,
  goToPrevious,
  goToNext,
  onBook,
}: {
  date: Date;
  courts: { id: string; name: string }[];
  sessions: Session[];
  closures: CourtClosure[];
  openingHours: unknown;
  getPlanEntriesForCourtAndDay: (
    courtId: string,
    dow: number
  ) => (PlanEntry & { court_id: string })[];
  goToPrevious: () => void;
  goToNext: () => void;
  onBook: (courtId: string, date: Date, timeSlot: string) => void;
}) {
  const planEntries = courts.flatMap((c) => getPlanEntriesForCourtAndDay(c.id, getDay(date)));

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={goToPrevious}
          aria-label="Vorheriger Tag"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">
          {format(date, 'EEEE, dd. MMMM yyyy', { locale: de })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={goToNext}
          aria-label="Nächster Tag"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="overflow-auto max-h-[70vh] p-3">
        <div
          className="grid gap-[3px] min-w-max"
          style={{ gridTemplateColumns: `48px repeat(${courts.length}, minmax(64px, 1fr))` }}
        >
          <div className="sticky top-0 z-10 bg-card" />
          {courts.map((c) => (
            <div
              key={c.id}
              className="sticky top-0 z-10 bg-card pb-1 text-center text-xs font-semibold"
            >
              {c.name}
            </div>
          ))}
          {DAILY_HOURS.map((h) => {
            const slot = `${String(h).padStart(2, '0')}:00`;
            return [
              <div
                key={`t${h}`}
                className="flex items-center text-2xs text-muted-foreground tabular-nums"
              >
                {slot}
              </div>,
              ...courts.map((c) => {
                const { status } = getSlotStatus(
                  c.id,
                  date,
                  slot,
                  sessions,
                  planEntries,
                  closures,
                  openingHours
                );
                const cell = CELL[status];
                const free = status === 'available';
                return (
                  <button
                    key={`${c.id}-${h}`}
                    type="button"
                    disabled={!free}
                    onClick={() => onBook(c.id, date, slot)}
                    aria-label={`${c.name} ${slot}: ${cell.label}`}
                    className={cn(
                      'h-9 rounded text-2xs font-medium transition-colors',
                      cell.className
                    )}
                  >
                    {cell.label}
                  </button>
                );
              }),
            ];
          })}
        </div>
      </div>
    </div>
  );
}
