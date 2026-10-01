'use client';

/**
 * Wochenübersicht des Platzkalenders: Tage als Zeilen, Stunden als Spalten, in jeder
 * Zelle die Zahl freier Plätze. Passt ohne Seitwärtsscrollen auf jede Breite — das
 * frühere 7-Tage-×-n-Plätze-Raster brauchte schon bei vier Plätzen 28 Spalten.
 * Ferien/Feiertage färben die Zeile gelb; Training findet dort nicht statt, die Plätze
 * bleiben buchbar. Klick auf eine Stunde öffnet den Tag.
 */
import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { de } from '@/lib/locale';
import { cn } from '@/lib/utils';
import type { Session } from '@/hooks/use-sessions';
import type { DayOff } from '@/hooks/use-holidays';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  summarizeSlot,
  type CalendarPlanEntry,
  type CourtClosure,
} from '@/lib/court-calendar-utils';

export interface WeekOverviewProps {
  weekDays: Date[];
  courts: { id: string }[];
  sessions: Session[];
  closures: CourtClosure[];
  openingHours: unknown;
  getPlanEntries: (courtId: string, date: Date) => CalendarPlanEntry[];
  dayOffFor: (date: Date) => DayOff | null;
  onPick: (day: Date, timeSlot: string) => void;
}

/** Je voller, desto dunkler (hell: Nachtblau, dunkel: Lime) — Helligkeit trägt die Info. */
function heatClass(free: number, total: number): string {
  if (total === 0) return 'bg-muted text-muted-foreground';
  const occupied = (total - free) / total;
  if (occupied === 0) return 'bg-muted/60 text-foreground';
  if (occupied <= 1 / 3) return 'bg-primary/15 text-foreground';
  if (occupied <= 2 / 3) return 'bg-primary/35 text-foreground';
  if (occupied < 1) return 'bg-primary/70 text-primary-foreground';
  return 'bg-primary text-primary-foreground';
}

const LEGEND = [
  { cls: 'bg-muted/60 border border-border', label: 'alles frei' },
  { cls: 'bg-primary/15', label: 'wenig belegt' },
  { cls: 'bg-primary/35', label: 'halb' },
  { cls: 'bg-primary/70', label: 'fast voll' },
  { cls: 'bg-primary', label: 'voll' },
];

export function WeekOverview({
  weekDays,
  courts,
  sessions,
  closures,
  openingHours,
  getPlanEntries,
  dayOffFor,
  onPick,
}: WeekOverviewProps) {
  const rows = useMemo(
    () =>
      weekDays.map((day) => ({
        day,
        off: dayOffFor(day),
        cells: TIME_SLOTS.map((ts) => ({
          ts,
          ...summarizeSlot(courts, day, ts, sessions, getPlanEntries, closures, openingHours),
        })),
      })),
    [weekDays, courts, sessions, getPlanEntries, closures, openingHours, dayOffFor]
  );
  const cols = {
    gridTemplateColumns: `var(--wo-label) repeat(${TIME_SLOTS.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm md:p-5 [--wo-label:2.75rem] md:[--wo-label:10.5rem]">
      <div className="grid items-end gap-0.5 px-1 pb-1 md:gap-1 md:px-1.5" style={cols}>
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tag
        </span>
        {TIME_SLOTS.map((ts, i) => (
          <span
            key={ts}
            className="text-center text-2xs tabular-nums text-muted-foreground md:text-xs"
          >
            {/* Am Handy nur jede zweite Stunde beschriften, sonst überlappen die Zahlen */}
            <span className={cn(i % 2 === 1 && 'hidden md:inline')}>{ts.slice(0, 2)}</span>
          </span>
        ))}
      </div>

      <div className="space-y-1">
        {rows.map(({ day, off, cells }) => {
          const today = isSameDay(day, new Date());
          const weekday = format(day, 'EEEE', { locale: de });
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'grid items-center gap-0.5 rounded-md p-1 md:gap-1 md:p-1.5',
                off && 'bg-warning-50'
              )}
              style={cols}
            >
              <div className="min-w-0 pl-0.5 leading-tight">
                {/* Handy: Wochentag über dem Datum, sonst reicht die Spalte nicht */}
                <div className="flex flex-col md:flex-row md:items-baseline md:gap-1.5">
                  <span className="text-xs font-bold md:text-sm">
                    {format(day, 'EEE', { locale: de })}
                  </span>
                  <span
                    className={cn(
                      'self-start rounded text-2xs tabular-nums md:px-1 md:text-sm',
                      today && 'bg-highlight font-semibold text-highlight-foreground'
                    )}
                  >
                    {format(day, 'dd.MM.')}
                  </span>
                </div>
                {off && (
                  <div className="truncate text-2xs font-semibold text-warning-800 md:text-xs">
                    {off.name}
                    <span className="hidden font-normal md:inline"> · kein Training</span>
                  </div>
                )}
              </div>
              {cells.map(({ ts, free, total, training }) => (
                <button
                  key={ts}
                  type="button"
                  onClick={() => onPick(day, ts)}
                  aria-label={`${weekday}, ${format(day, 'd. MMMM', { locale: de })}, ${ts} Uhr: ${free} von ${total} Plätzen frei${training ? ', mit Training' : ''}`}
                  className={cn(
                    'flex h-7 min-w-0 flex-col items-center justify-center gap-0.5 rounded text-2xs font-bold tabular-nums transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-sm',
                    heatClass(free, total)
                  )}
                >
                  <span>{free === 0 && total > 0 ? '–' : free}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'hidden h-0.5 w-3 rounded-full bg-current opacity-60 md:block',
                      !training && 'invisible'
                    )}
                  />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Zahl = freie Plätze</span>
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn('h-3 w-4 rounded', l.cls)} aria-hidden="true" />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-foreground/60" aria-hidden="true" />
          Training in der Stunde
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-4 rounded bg-warning-50 border border-warning-200"
            aria-hidden="true"
          />
          Ferien/Feiertag – kein Training
        </span>
        <span className="md:ml-auto">Klick auf eine Stunde öffnet den Tag</span>
      </div>
    </div>
  );
}
