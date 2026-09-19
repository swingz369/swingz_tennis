import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { getSessionForSlot } from '@/lib/court-calendar-utils';
import { useCreateBooking, useCancelBooking, useUpdateBookingStatus } from '@/hooks/use-sessions';
import type { Session } from '@/hooks/use-sessions';
import type { PendingBooking } from '@/components/booking/booking-confirm-dialog';

/** Buchungs-Aktionen des Platzkalenders — Direktbuchung, Slot-Buchung
 *  (bucht eine bestehende Session oder legt per Direktbuchung eine neue an),
 *  Stornierung, sowie die Monatsansicht-Varianten (Buchung/Status direkt
 *  über die Session-ID statt über Platz+Zeit). */
export function useCourtBookingActions({
  clubId,
  memberId,
  sessions,
  openingHours,
  courts,
}: {
  clubId: string | null;
  memberId: string | null;
  sessions: Session[];
  openingHours: unknown;
  courts: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();
  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const courtName = useCallback(
    (id: string) => courts.find((c) => c.id === id)?.name ?? 'Platz',
    [courts]
  );

  // ── Monatsansicht (Phase 2.1: übernommen aus /bookings) — bucht direkt über
  // die Session-ID statt über Platz+Zeit wie handleBookSlot. ──
  const handleBookSession = useCallback(
    (sessionId: string) => {
      if (!memberId || !clubId) {
        toast.error('Bitte einloggen um zu buchen');
        return;
      }
      const session = sessions.find((x) => x.id === sessionId);
      if (!session?.courtId || !session.timeslotStart || !session.timeslotEnd) {
        createBooking.mutate({ memberId, sessionId, clubId });
        return;
      }
      const start = new Date(session.timeslotStart);
      setPending({
        courtId: session.courtId,
        courtName: courtName(session.courtId),
        date: start,
        startTime: session.startTime,
        endTime: session.endTime,
        isSession: true,
        sessionId,
      });
    },
    [memberId, clubId, sessions, createBooking, courtName]
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
      const [h, m] = timeSlot.split(':').map(Number);
      const endTime = session
        ? session.endTime
        : `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(h + 1 > 23 ? 59 : m).padStart(2, '0')}`;
      setPending({
        courtId,
        courtName: courtName(courtId),
        date,
        startTime: timeSlot,
        endTime,
        isSession: Boolean(session),
        sessionId: session?.id,
      });
    },
    [memberId, clubId, sessions, openingHours, courtName]
  );

  const confirmPending = useCallback(async () => {
    if (!pending || !memberId || !clubId) return;
    setSubmitting(true);
    try {
      if (pending.sessionId) {
        await createBooking.mutateAsync({ memberId, sessionId: pending.sessionId, clubId });
      } else {
        await directBookSlot(
          pending.courtId,
          format(pending.date, 'yyyy-MM-dd'),
          pending.startTime,
          pending.endTime
        );
      }
    } catch {
      // Fehlermeldung zeigt die Mutation bzw. directBookSlot selbst
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  }, [pending, memberId, clubId, createBooking, directBookSlot]);

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
    bookingDialog: {
      pending,
      submitting,
      onConfirm: confirmPending,
      onClose: () => setPending(null),
    },
  };
}
