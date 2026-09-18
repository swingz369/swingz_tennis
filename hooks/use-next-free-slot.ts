import { useCallback, useMemo } from 'react';
import { addDays, getDay as dateFnsGetDay } from 'date-fns';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  getSlotStatus,
  type CourtClosure,
} from '@/lib/court-calendar-utils';
import type { Session } from '@/hooks/use-sessions';
import type { PlanEntry } from '@/components/calendar/types';

// Saisonplan-Konvention: 0 = Montag … 6 = Sonntag (JS: 0 = Sonntag)
function jsDayToApiDay(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * Scannt Plätze × kommende 7 Tage × Stunden-Slots nach dem ersten freien Termin.
 * Als eigenständige Funktion gehalten (statt Logik direkt im useMemo), damit der
 * React Compiler die Memoization sauber ableiten kann.
 */
function findNextFreeSlot(
  courts: { id: string; name: string }[],
  sessions: Session[],
  closures: CourtClosure[],
  getPlanEntries: (courtId: string, dayOfWeek: number) => (PlanEntry & { court_id: string })[],
  openingHours: unknown
): { courtId: string; courtName: string; date: Date; timeSlot: string } | null {
  if (courts.length === 0) return null;
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(now, dayOffset);
    for (const timeSlot of TIME_SLOTS) {
      const [h, m] = timeSlot.split(':').map(Number);
      const slotDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      if (slotDateTime <= now) continue;
      const court = courts.find((c) => {
        const planEntriesForDay = getPlanEntries(c.id, dateFnsGetDay(date));
        const { status } = getSlotStatus(
          c.id,
          date,
          timeSlot,
          sessions,
          planEntriesForDay,
          closures,
          openingHours
        );
        return status === 'available';
      });
      if (court) return { courtId: court.id, courtName: court.name, date, timeSlot };
    }
  }
  return null;
}

/** Platz-/Tag-Filter für Planeinträge (Saisonplan-Overlay) + "Nächster freier
 *  Platz"-Vorschlag der Agenda-Ansicht — beide bauen auf denselben
 *  rollen-gefilterten `visiblePlanSlots` auf. */
export function useNextFreeSlot({
  visiblePlanSlots,
  courts,
  visibleSessions,
  courtClosures,
  openingHours,
}: {
  visiblePlanSlots: PlanEntry[];
  courts: { id: string; name: string }[];
  visibleSessions: Session[];
  courtClosures: CourtClosure[];
  openingHours: unknown;
}) {
  const getPlanEntriesForCourtAndDay = useCallback(
    (courtId: string, dayOfWeek: number) => {
      const apiDay = jsDayToApiDay(dayOfWeek);
      return visiblePlanSlots.filter(
        (slot) => slot.court_id === courtId && slot.day_of_week === apiDay
      );
    },
    [visiblePlanSlots]
  );

  const getPlanEntriesForNextFree = useCallback(
    (courtId: string, dayOfWeek: number) =>
      getPlanEntriesForCourtAndDay(courtId, dayOfWeek).filter(
        (e): e is PlanEntry & { court_id: string } => e.court_id !== null
      ),
    [getPlanEntriesForCourtAndDay]
  );

  const nextFreeSlot = useMemo(
    () =>
      findNextFreeSlot(
        courts,
        visibleSessions,
        courtClosures,
        getPlanEntriesForNextFree,
        openingHours
      ),
    [courts, visibleSessions, courtClosures, getPlanEntriesForNextFree, openingHours]
  );

  return { getPlanEntriesForCourtAndDay, getPlanEntriesForNextFree, nextFreeSlot };
}
