/**
 * Court Calendar Utilities
 *
 * Shared constants and helper functions used across court calendar components:
 * - components/unified-court-calendar.tsx
 * - components/daily-court-view.tsx
 */

import { setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import type { Session } from '@/hooks/use-sessions';

/** Standard hourly time slots for court booking views (06:00–22:00) */
export const CALENDAR_TIME_SLOTS = [
  '06:00',
  '07:00',
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

/**
 * Determine the visual status of a calendar slot.
 */
export function getSlotStatus(
  courtId: string,
  date: Date,
  timeSlot: string,
  sessions: Session[],
  planEntries: Array<{ court_id: string; start_time: string; end_time: string }>
): { status: SlotStatus; session?: Session } {
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

  const hasPlanEntry = planEntries.some(
    (e) => e.court_id === courtId && e.start_time <= timeSlot && e.end_time > timeSlot
  );
  if (hasPlanEntry) return { status: 'plan' };

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
    'bg-emerald-50/60 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm cursor-pointer',
  session:
    'bg-gradient-to-r from-blue-100 to-blue-200/70 text-blue-800 border-l-[3px] border-l-blue-500 border border-blue-200 shadow-sm',
  booked:
    'bg-gradient-to-r from-amber-100 via-amber-100 to-amber-200 text-amber-900 border-l-[4px] border-l-amber-600 border border-amber-300 shadow-md ring-1 ring-inset ring-amber-200/60',
  'own-booking':
    'bg-gradient-to-r from-rose-100 to-rose-200/70 text-rose-800 border-l-[3px] border-l-rose-500 border border-rose-200 shadow-sm',
  plan: 'bg-violet-50/60 text-violet-700 border border-violet-200/60',
  blocked: 'bg-zinc-50 text-muted-foreground border border-zinc-200/80 cursor-not-allowed',
};

/** Admin override for blocked slots — adds hover effect + cursor-pointer */
export const SLOT_STATUS_STYLES_ADMIN_BLOCKED =
  'bg-zinc-50 text-muted-foreground border border-zinc-200/80 cursor-pointer hover:bg-zinc-100 hover:shadow-sm';

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
    bg: 'bg-emerald-50/60 border-emerald-200/60',
    text: 'text-emerald-700',
    accent: 'border-l-emerald-500',
  },
  session: {
    bg: 'bg-blue-100 border-blue-200 shadow-sm',
    text: 'text-blue-800',
    accent: 'border-l-blue-500',
  },
  booked: {
    bg: 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300 shadow-md ring-1 ring-inset ring-amber-200/60',
    text: 'text-amber-900',
    accent: 'border-l-amber-600',
  },
  'own-booking': {
    bg: 'bg-rose-100 border-rose-200 shadow-sm',
    text: 'text-rose-800',
    accent: 'border-l-rose-500',
  },
  blocked: {
    bg: 'bg-zinc-100 border-zinc-300 shadow-sm',
    text: 'text-zinc-600',
    accent: 'border-l-zinc-400',
  },
};

/**
 * Legend items for the court calendar footer.
 * Single source of truth — dot colors derived from SLOT_STATUS_STYLES palette.
 */
export type LegendItem = { label: string; className: string };

export function getCalendarLegendItems(isAdmin: boolean): LegendItem[] {
  const items: LegendItem[] = [
    { label: 'Verfügbar', className: 'bg-emerald-500' },
    { label: 'Gruppentraining', className: 'bg-violet-500' },
  ];

  if (isAdmin) {
    items.push({ label: 'Session (Drag & Drop)', className: 'bg-blue-500' });
    items.push({ label: 'Gesperrt', className: 'bg-zinc-400' });
  } else {
    items.push({ label: 'Offene Session', className: 'bg-blue-500' });
    items.push({ label: 'Belegt (gebucht)', className: 'bg-amber-500' });
    items.push({ label: 'Deine Buchung', className: 'bg-rose-500' });
  }

  return items;
}
