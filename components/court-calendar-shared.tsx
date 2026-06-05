'use client';

import React from 'react';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';

/**
 * Shared header with title, subtitle, week navigation, and daily-view button.
 * Pass export buttons or other custom actions via `children`.
 */
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
  onGoDaily: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onGoDaily}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          Tagesansicht
        </Button>
        {children}
        <Button variant="outline" size="sm" onClick={onGoToday}>
          Heute
        </Button>
        <Button variant="outline" size="icon" onClick={onGoPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[150px] text-center font-medium text-sm md:text-base">
          {format(weekStart, 'dd.MM', { locale: de })} -{' '}
          {format(weekEnd, 'dd.MM.yyyy', { locale: de })}
        </span>
        <Button variant="outline" size="icon" onClick={onGoNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Wrapper for the horizontally scrollable calendar grid. */
export function CourtCalendarGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-[800px]">{children}</div>
    </div>
  );
}

/** Header row showing day-of-week abbreviations and dates. */
export function WeekDaysHeaderRow({ weekDays }: { weekDays: Date[] }) {
  return (
    <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-muted rounded-t-lg overflow-hidden">
      <div className="bg-muted p-2 text-center font-semibold text-foreground text-xs">Platz</div>
      {weekDays.map((day) => (
        <div
          key={day.toISOString()}
          className="bg-muted p-2 text-center font-semibold text-foreground text-xs"
        >
          <div>{format(day, 'EEE', { locale: de })}</div>
          <div className="text-[11px] text-muted-foreground">{format(day, 'dd.MM')}</div>
        </div>
      ))}
    </div>
  );
}

/** Court info cell shown in the leftmost column of each court row. */
export function CourtRowHeader({
  court,
}: {
  court: { name: string; surface: string; hasIndoor?: boolean };
}) {
  return (
    <div className="bg-background p-2 flex items-center gap-2 border-r border-border">
      <div className="flex-1">
        <div className="font-medium text-sm">{court.name}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{getSurfaceLabel(court.surface)}</span>
          {court.hasIndoor && <span>• Indoor</span>}
        </div>
      </div>
    </div>
  );
}

/** Configurable availability legend. */
export function CourtCalendarLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${item.className}`}></div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
