/**
 * Court Calendar Utilities
 *
 * Shared constants and helper functions used across court calendar components:
 * - components/unified-court-calendar.tsx
 * - components/daily-court-view.tsx
 */

import { setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import type { Session } from '@/hooks/use-sessions';
import { isDayClosed } from '@/lib/booking/opening-hours';

/** Standard hourly time slots for court booking views (08:00–22:00) */
export const CALENDAR_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
] as const;

/** Maps court surface codes to German labels */
export function getSurfaceLabel(surface: string): string {
  const labels: Record<string, string> = {
    clay: 'Sand',
    grass: 'Rasen',
    hard: 'Hartplatz',
    carpet: 'Teppich',
    artificial_grass: 'Kunstrasen',
  };
  return labels[surface] || surface;
}

/** Visual status of a calendar slot */
export type SlotStatus = 'available' | 'session' | 'booked' | 'own-booking' | 'plan' | 'blocked';

/**
 * Find the session that covers a given court+date+timeslot.
 * Returns undefined if no session occupies that slot.
 */
export function getSessionForSlot(
  courtId: string,
  date: Date,
  timeSlot: string,
  sessions: Session[]
): Session | undefined {
  const [hour, minute] = timeSlot.split(':').map(Number);
  const slotStart = setMinutes(setHours(date, hour), minute);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

  return sessions.find((session) => {
    if (!session.courtId || session.courtId !== courtId) return false;
    // Use timeslotStart (ISO date string) for accurate date matching
    if (!session.timeslotStart || !session.timeslotEnd) return false;

    const sessionStart = new Date(session.timeslotStart);
    const sessionEnd = new Date(session.timeslotEnd);

    return (
      isSameDay(sessionStart, date) &&
      (isBefore(slotStart, sessionEnd) || slotStart.getTime() === sessionStart.getTime()) &&
      (isAfter(slotEnd, sessionStart) || slotEnd.getTime() === sessionEnd.getTime())
    );
  });
}

/** Admin-created court closure (court_closures table) — date-range block. */
export interface CourtClosure {
  id: string;
  court_id: string;
  reason: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  weather_condition?: string | null;
}

/**
 * Find the closure that covers a given court+date+timeslot.
 * `end_date === null` means the closure blocks indefinitely from `start_date` on
 * (matches the "aktiv bis manuell aufgehoben" semantics used in the Platzsperren-UI).
 */
export function getClosureForSlot(
  courtId: string,
  date: Date,
  timeSlot: string,
  closures: CourtClosure[]
): CourtClosure | undefined {
  const [hour, minute] = timeSlot.split(':').map(Number);
  const slotStart = setMinutes(setHours(date, hour), minute);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

  return closures.find((c) => {
    if (c.court_id !== courtId) return false;
    const rangeStart = new Date(c.start_date);
    const rangeEnd = c.end_date ? new Date(c.end_date) : null;
    return rangeEnd ? slotStart < rangeEnd && slotEnd > rangeStart : slotEnd > rangeStart;
  });
}

/**
 * Determine the visual status of a calendar slot.
 */
export interface CalendarPlanEntry {
  court_id: string;
  start_time: string;
  end_time: string;
  group_name?: string;
  group_color?: string;
  trainer_name?: string;
  [k: string]: unknown;
}

export function getSlotStatus(
  courtId: string,
  date: Date,
  timeSlot: string,
  sessions: Session[],
  planEntries: CalendarPlanEntry[],
  closures: CourtClosure[] = [],
  openingHours: unknown = null
): {
  status: SlotStatus;
  session?: Session;
  closure?: CourtClosure;
  planEntry?: CalendarPlanEntry;
  closedDay?: boolean;
} {
  const session = getSessionForSlot(courtId, date, timeSlot, sessions);
  if (session) {
    // Blocked sessions (event/maintenance) take visual priority
    if (session.sessionType === 'event' || session.sessionType === 'maintenance') {
      return { status: 'blocked', session };
    }
    // Booked by current user → red "Deine Buchung"
    if (session.bookedByUser) return { status: 'own-booking', session };
    // Someone else booked → orange "Belegt" (unavailable)
    if (session.hasActiveBooking) return { status: 'booked', session };
    return { status: 'session', session };
  }

  // Admin-created closure (Platzverwaltung / Wochenstundenplan "Platz sperren") — same
  // visual status as an event/maintenance session, just from the court_closures table.
  const closure = getClosureForSlot(courtId, date, timeSlot, closures);
  if (closure) return { status: 'blocked', closure };

  const planEntry = planEntries.find(
    (e) => e.court_id === courtId && e.start_time <= timeSlot && e.end_time > timeSlot
  );
  if (planEntry) return { status: 'plan', planEntry };

  // Geschlossener Tag (Öffnungszeiten): freie Slots als gesperrt anzeigen,
  // statt erst beim Buchungsversuch mit "Tag ist geschlossen" zu scheitern.
  if (isDayClosed(openingHours, date)) return { status: 'blocked', closedDay: true };

  return { status: 'available' };
}

/**
 * Tailwind classes for each slot status.
 * Single source of truth — used by the weekly view in unified-court-calendar.tsx.
 * Colors: Emerald (available), Blue (session), Violet (plan), Rose (own-booking),
 * Amber (booked), Zinc (blocked).
 */
export const SLOT_STATUS_STYLES: Record<SlotStatus, string> = {
  available:
    'bg-success-50/60 text-success-700 border border-success-200/60 hover:bg-success-100 hover:border-success-300 hover:shadow-sm cursor-pointer',
  session:
    'bg-gradient-to-r from-info-100 to-info-200/70 text-info-800 border-l-[3px] border-l-info-500 border border-info-200 shadow-sm',
  booked:
    'bg-gradient-to-r from-warning-100 via-warning-100 to-warning-200 text-warning-900 border-l-[4px] border-l-warning-600 border border-warning-300 shadow-md ring-1 ring-inset ring-warning-200/60',
  'own-booking':
    'bg-gradient-to-r from-error-100 to-error-200/70 text-error-800 border-l-[3px] border-l-error-500 border border-error-200 shadow-sm',
  plan: 'bg-info-50/60 text-info-700 border border-info-200/60',
  blocked: 'bg-gray-50 text-muted-foreground border border-gray-200/80 cursor-not-allowed',
};

/** Admin override for blocked slots — adds hover effect + cursor-pointer */
export const SLOT_STATUS_STYLES_ADMIN_BLOCKED =
  'bg-gray-50 text-muted-foreground border border-gray-200/80 cursor-pointer hover:bg-gray-100 hover:shadow-sm';

/**
 * Decomposed style tokens for the daily-view PositionedSessionBlock.
 * Extracted from SLOT_STATUS_STYLES to keep weekly and daily views in sync.
 */
export const DAILY_BLOCK_STYLES: Record<
  'available' | 'session' | 'booked' | 'own-booking' | 'blocked',
  { bg: string; text: string; accent: string }
> = {
  /* Note: 'available' is kept for API completeness but is not used by
     PositionedSessionBlock (which only renders when a session exists). */
  available: {
    bg: 'bg-success-50/60 border-success-200/60',
    text: 'text-success-700',
    accent: 'border-l-success-500',
  },
  session: {
    bg: 'bg-info-100 border-info-200 shadow-sm',
    text: 'text-info-800',
    accent: 'border-l-info-500',
  },
  booked: {
    bg: 'bg-gradient-to-br from-warning-100 to-warning-200 border-warning-300 shadow-md ring-1 ring-inset ring-warning-200/60',
    text: 'text-warning-900',
    accent: 'border-l-warning-600',
  },
  'own-booking': {
    bg: 'bg-error-100 border-error-200 shadow-sm',
    text: 'text-error-800',
    accent: 'border-l-error-500',
  },
  blocked: {
    bg: 'bg-gray-100 border-gray-300 shadow-sm',
    text: 'text-gray-600',
    accent: 'border-l-gray-400',
  },
};

/**
 * Legend items for the court calendar footer.
 * Single source of truth — dot colors derived from SLOT_STATUS_STYLES palette.
 */
export type LegendItem = { label: string; className: string };

export function getCalendarLegendItems(isAdmin: boolean): LegendItem[] {
  const items: LegendItem[] = [
    { label: 'Verfügbar', className: 'bg-success-500' },
    { label: 'Gruppentraining', className: 'bg-info-500' },
  ];

  if (isAdmin) {
    items.push({ label: 'Session (Drag & Drop)', className: 'bg-info-500' });
    items.push({ label: 'Gesperrt', className: 'bg-gray-400' });
  } else {
    items.push({ label: 'Offene Session', className: 'bg-info-500' });
    items.push({ label: 'Belegt (gebucht)', className: 'bg-warning-500' });
    items.push({ label: 'Deine Buchung', className: 'bg-error-500' });
  }

  return items;
}
