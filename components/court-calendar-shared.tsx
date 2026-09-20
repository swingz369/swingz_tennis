'use client';

import React from 'react';
import { format, isToday } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import type { DayOff } from '@/hooks/use-holidays';

/** Thin wrapper around CalendarShell for the court/booking calendar. */
export function CourtCalendarHeader({
  title,
  subtitle,
  weekStart,
  weekEnd,
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
  onGoPrevious: () => void;
  onGoNext: () => void;
  onGoToday: () => void;
  onGoDaily?: () => void;
  children?: React.ReactNode;
}) {
  const navLabel = `${format(weekStart, 'dd.MM', { locale: de })} – ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`;

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
export function CourtCalendarGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="min-w-[900px] rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/**
 * Header row showing day-of-week abbreviations and dates.
 * Today column gets a distinct highlight.
 */
export function WeekDaysHeaderRow({
  weekDays,
  dayOffFor,
}: {
  weekDays: Date[];
  dayOffFor?: (date: Date) => DayOff | null;
}) {
  return (
    <div className="grid grid-cols-[180px_repeat(7,1fr)] bg-muted/50">
      <div className="p-3 flex items-center justify-center border-b border-r border-border/40">
        <span className="text-xs font-bold text-muted-foreground">Platz</span>
      </div>
      {weekDays.map((day) => {
        const today = isToday(day);
        const dayOff = dayOffFor?.(day);
        return (
          <div
            key={day.toISOString()}
            className={`p-3 text-center border-b border-border/40 last:border-r-0 transition-colors ${
              today ? 'bg-primary/5 border-b-primary/30' : 'hover:bg-muted/30'
            } ${dayOff ? 'bg-warning-50 dark:bg-warning-900/20' : ''}`}
          >
            <div
              className={`text-xs font-bold ${today ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {format(day, 'EEE', { locale: de })}
            </div>
            <div
              className={`mt-1 text-sm font-bold tabular-nums ${
                today
                  ? 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground'
                  : 'text-foreground'
              }`}
            >
              {format(day, 'd')}
            </div>
            {dayOff && (
              <div className="mt-1 text-2xs font-semibold text-warning-800 dark:text-warning-200 leading-tight">
                {dayOff.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Court info cell shown in the leftmost column of each court row.
 * Displays court name, surface badge, and indoor indicator.
 */
export function CourtRowHeader({
  court,
}: {
  court: { name: string; surface: string; hasIndoor?: boolean };
}) {
  return (
    <div className="p-3 flex items-center gap-2.5 border-r border-border/40 bg-muted/20">
      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground truncate">{court.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-2xs font-medium text-muted-foreground border border-border/50">
            {getSurfaceLabel(court.surface)}
          </span>
          {court.hasIndoor && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-info-50 text-2xs font-medium text-info-600 border border-info-100">
              Indoor
            </span>
          )}
        </div>
      </div>
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
