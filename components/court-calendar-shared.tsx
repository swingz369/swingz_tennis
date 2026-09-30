'use client';

import React from 'react';
import { format, isToday } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import type { DayOff } from '@/hooks/use-holidays';

/** Thin wrapper around CalendarShell for the court/booking calendar. */
export function CourtCalendarHeader({
  title,
  subtitle,
  weekStart,
  weekEnd,
  day,
  onGoPrevious,
  onGoNext,
  onGoToday,
  onGoDaily,
  children,
}: {
  title: string;
  subtitle: string;
  weekStart: Date;
  weekEnd: Date;
  /** Tagesansicht: zeigt dieses Datum statt der Kalenderwoche */
  day?: Date;
  onGoPrevious: () => void;
  onGoNext: () => void;
  onGoToday: () => void;
  onGoDaily?: () => void;
  children?: React.ReactNode;
}) {
  const navLabel = day
    ? format(day, 'EEE, dd.MM.yyyy', { locale: de })
    : `${format(weekStart, 'dd.MM', { locale: de })} – ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`;

  return (
    <CalendarShell
      title={title}
      subtitle={subtitle}
      nav={{ label: navLabel, onPrev: onGoPrevious, onNext: onGoNext, onToday: onGoToday }}
      controls={
        <>
          {onGoDaily && (
            <Button variant="outline" size="sm" onClick={onGoDaily} className="gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Tagesansicht
            </Button>
          )}
          {children}
        </>
      }
    />
  );
}

/**
 * Wrapper for the horizontally scrollable calendar grid.
 */
export function CourtCalendarGrid({
  children,
  minWidth = 900,
}: {
  children: React.ReactNode;
  /** Mindestbreite in px — die Wochenansicht wächst mit der Zahl der Plätze. */
  minWidth?: number;
}) {
  return (
    <div className="relative overflow-x-auto -mx-4 px-4 pb-2">
      <div
        className="rounded-xl border border-border bg-card overflow-clip"
        style={{ minWidth: Math.max(900, minWidth) }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Kopfzeile der Wochenansicht (Matchday): Zeitspalte, je Tag Kürzel und
 * Datum, darunter die Platz-Streifen der Tagesspalte. Heute: getönte Spalte,
 * Datum in der Link-Farbe — wie in der Vorlage.
 */
export function WeekDaysHeaderRow({
  weekDays,
  dayOffFor,
  courts = [],
}: {
  weekDays: Date[];
  dayOffFor?: (date: Date) => DayOff | null;
  courts?: { id: string; name: string }[];
}) {
  // „Platz 3" → „3"; andere Namen bleiben (gekürzt über truncate).
  const short = (name: string) => name.replace(/^Platz\s*/i, '') || name;
  return (
    <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
      <div className="sticky left-0 z-10 flex items-end border-r border-border bg-card px-2 pb-2 text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Zeit
      </div>
      {weekDays.map((day) => {
        const today = isToday(day);
        const dayOff = dayOffFor?.(day);
        return (
          <div
            key={day.toISOString()}
            className={`border-r border-border px-1 pt-3 text-center last:border-r-0 ${
              dayOff ? 'bg-warning-50' : today ? 'bg-muted/60' : ''
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {format(day, 'EEE', { locale: de })}
            </div>
            <div
              className={`text-2xl font-bold leading-tight tabular-nums ${today ? 'text-ring' : 'text-foreground'}`}
            >
              {format(day, 'd')}
            </div>
            {dayOff && (
              <div className="text-2xs font-semibold leading-tight text-warning-800">
                {dayOff.name}
              </div>
            )}
            {courts.length > 1 ? (
              <div
                className="mt-2 grid gap-x-0.5 pb-1.5"
                style={{ gridTemplateColumns: `repeat(${courts.length}, minmax(0, 1fr))` }}
              >
                {courts.map((c) => (
                  <span
                    key={c.id}
                    title={c.name}
                    className="truncate text-3xs font-semibold text-muted-foreground"
                  >
                    {short(c.name)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="pb-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Modern legend with colored dots instead of filled squares.
 */
export function CourtCalendarLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full shadow-sm ${item.className}`} />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
