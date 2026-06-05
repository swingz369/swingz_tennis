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
export type SlotStatus = 'available' | 'session' | 'booked' | 'plan' | 'blocked';

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
    if (!session.week) return false;

    const sessionDate = new Date(session.week);
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);

    const sessionStart = setMinutes(setHours(sessionDate, startHour), startMinute);
    const sessionEnd = setMinutes(setHours(sessionDate, endHour), endMinute);

    return (
      isSameDay(sessionDate, date) &&
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
    return { status: session.bookedByUser ? 'booked' : 'session', session };
  }

  const hasPlanEntry = planEntries.some(
    (e) => e.court_id === courtId && e.start_time <= timeSlot && e.end_time > timeSlot
  );
  if (hasPlanEntry) return { status: 'plan' };

  return { status: 'available' };
}

/** Tailwind classes for each slot status */
export const SLOT_STATUS_STYLES: Record<SlotStatus, string> = {
  available: 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 cursor-pointer',
  session: 'bg-muted text-muted-foreground border border-border',
  booked: 'bg-red-50 text-red-800 border border-red-200',
  plan: 'bg-purple-50 text-purple-700 border border-purple-200',
  blocked: 'bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed',
};
