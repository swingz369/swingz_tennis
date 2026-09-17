import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { getSessionForSlot } from '@/lib/court-calendar-utils';
import { useCreateBooking, useCancelBooking, useUpdateBookingStatus } from '@/hooks/use-sessions';
import type { Session } from '@/hooks/use-sessions';

/** Buchungs-Aktionen des Platzkalenders — Direktbuchung, Slot-Buchung
 *  (bucht eine bestehende Session oder legt per Direktbuchung eine neue an),
 *  Stornierung, sowie die Monatsansicht-Varianten (Buchung/Status direkt
 *  über die Session-ID statt über Platz+Zeit). */
export function useCourtBookingActions({
  clubId,
  memberId,
  sessions,
  openingHours,
}: {
  clubId: string | null;
  memberId: string | null;
  sessions: Session[];
  openingHours: unknown;
}) {
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();

  // ── Monatsansicht (Phase 2.1: übernommen aus /bookings) — bucht direkt über
  // die Session-ID statt über Platz+Zeit wie handleBookSlot. ──
  const handleBookSession = useCallback(
    (sessionId: string) => {
      if (!memberId || !clubId) {
        toast.error('Bitte einloggen um zu buchen');
        return;
      }
      createBooking.mutate({ memberId, sessionId, clubId });
    },
    [memberId, clubId, createBooking]
  );

  const handleStatusChange = useCallback(
    (bookingId: string, status: 'pending' | 'confirmed' | 'cancelled' | 'no_show') => {
      if (!clubId) return;
      updateBookingStatus.mutate({ bookingId, status, clubId });
    },
    [clubId, updateBookingStatus]
  );

  // ── Direct booking (walk-in) ──
  const directBookSlot = useCallback(
    async (courtId: string, date: string, startTime: string, endTime: string) => {
      if (!clubId) return;
      try {
        const res = await apiFetch('/api/bookings/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courtId, date, startTime, endTime, clubId }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(extractErrorMessage(err) ?? 'Direktbuchung fehlgeschlagen');
          return;
        }
        toast.success('Platz gebucht!');
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } catch {
        toast.error('Netzwerkfehler bei der Direktbuchung');
      }
    },
    [clubId, queryClient]
  );

  const handleBookSlot = useCallback(
    (courtId: string, date: Date, timeSlot: string) => {
      if (!memberId || !clubId) {
        toast.error('Bitte einloggen um zu buchen');
        return;
      }
      // Defense in depth: auch offene Sessions an geschlossenen Tagen nicht buchen.
      if (isDayClosed(openingHours, date)) {
        toast.error(CLOSED_DAY_ERROR);
        return;
      }
      const session = getSessionForSlot(courtId, date, timeSlot, sessions);
      if (session) {
        createBooking.mutate({ memberId, sessionId: session.id, clubId });
      } else {
        const dateStr = format(date, 'yyyy-MM-dd');
        const [h, m] = timeSlot.split(':').map(Number);
        const endH = h + 1;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        directBookSlot(courtId, dateStr, timeSlot, endTime);
      }
    },
    [memberId, clubId, sessions, createBooking, directBookSlot, openingHours]
  );

  const handleCancelBooking = useCallback(
    (sessionId: string, bookingId: string) => {
      if (!clubId) return;
      cancelBooking.mutate({ bookingId, sessionId, clubId });
    },
    [clubId, cancelBooking]
  );

  return {
    handleBookSession,
    handleStatusChange,
    handleBookSlot,
    handleCancelBooking,
  };
}
