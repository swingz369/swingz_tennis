import { extractErrorMessage } from '@/lib/typed-helpers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';
import { apiFetch } from '@/lib/api-fetch';

export interface Session {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  trainerId: string;
  trainerName?: string;
  groupIds: string[];
  groupNames?: string[];
  maxParticipants: number;
  notes?: string;
  sessionType?: 'training' | 'walk_in' | 'event' | 'maintenance';
  bookedByUser?: boolean;
  bookingId?: string;
  bookingStatus?: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
  hasActiveBooking?: boolean; // Any confirmed/pending booking exists for this session
  currentBookings?: number; // Number of active bookings
  timeslotStart?: string; // ISO date string of session start
  timeslotEnd?: string; // ISO date string of session end
  courtId?: string; // For admin court calendar
  courtName?: string; // Court display name for member training schedule
  rsvpStatus?: string | null; // Current user's RSVP status for the session
  bookerNames?: string[]; // Names of members who booked this session
  cancelledAt?: string | null; // ISO date string if session was cancelled
  cancellationReason?: string | null;
  planEntryId?: string | null; // gesetzt, wenn die Session aus der Saisonplanung stammt (editierbar für Admin)
}

export function useSessions(
  clubId: string | null,
  dateRange?: { dateFrom?: string; dateTo?: string },
  actingAsMemberId?: string | null
) {
  return useQuery({
    queryKey: [
      ...QUERY_KEYS.sessions(clubId || ''),
      dateRange?.dateFrom,
      dateRange?.dateTo,
      actingAsMemberId,
    ],
    queryFn: async ({ signal }) => {
      if (!clubId) return [];

      const params = new URLSearchParams({ clubId });
      if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
      if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
      if (actingAsMemberId) params.set('actingAsMemberId', actingAsMemberId);

      const res = await apiFetch(`/api/sessions?${params}`, {
        credentials: 'include',
        signal, // Support cancellation
      });

      if (!res.ok) {
        throw new Error('Sessions konnten nicht geladen werden');
      }

      const data = await res.json();

      // Handle new response format with warnings
      if (data.sessions) {
        // Show warning toast if bookings failed to load
        if (data.warnings?.bookings) {
          toast.warning(data.warnings.bookings, {
            description: 'Deine Buchungen konnten nicht geladen werden',
          });
        }
        return data.sessions;
      }

      // Fallback for old response format (just array)
      return Array.isArray(data) ? data : [];
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.SHORT,
    gcTime: STALE_TIMES.SHORT * 2,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      sessionId,
      clubId,
    }: {
      memberId: string;
      sessionId: string;
      clubId: string;
    }) => {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ memberId, sessionId, clubId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Buchung fehlgeschlagen');
      }

      return res.json();
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.sessions(variables.clubId) });

      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(QUERY_KEYS.sessions(variables.clubId));

      // Optimistically update to the new value
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: Session[] | undefined) =>
          old?.map((s: Session) =>
            s.id === variables.sessionId
              ? { ...s, bookedByUser: true, bookingStatus: 'pending' }
              : s
          ) || []
      );

      // Return context with snapshot
      return { previousSessions };
    },
    onSuccess: (data, variables) => {
      // Use server response as source of truth
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: Session[] | undefined) =>
          old?.map((s: Session) =>
            s.id === variables.sessionId
              ? { ...s, bookedByUser: true, bookingId: data.bookingId, bookingStatus: data.status }
              : s
          ) || []
      );

      // If the booking requires payment, initiate Stripe checkout
      if (data.bookingId && data.payment_status === 'pending' && data.requiresPayment) {
        toast.loading('Weiterleitung zur Zahlung…', { id: 'payment-redirect' });
        apiFetch('/api/stripe/checkout', {
          method: 'POST',
          body: JSON.stringify({
            type: 'booking',
            bookingId: data.bookingId,
            clubId: variables.clubId,
            description: 'Platzbuchung',
          }),
        })
          .then((res) => res.json())
          .then((result) => {
            toast.dismiss('payment-redirect');
            if (result.simulated) {
              toast.success('Buchung bestätigt (Testzahlung)');
            } else if (result.url) {
              window.location.href = result.url;
            } else {
              toast.error('Zahlung konnte nicht gestartet werden');
            }
          })
          .catch(() => {
            toast.dismiss('payment-redirect');
            toast.error('Fehler beim Starten der Zahlung');
          });
      } else {
        toast.success('Buchung erfolgreich');
      }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(QUERY_KEYS.sessions(variables.clubId), context.previousSessions);
      }
      toast.error(error instanceof Error ? error.message : 'Buchung fehlgeschlagen');
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions(variables.clubId) });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      sessionId: _sessionId,
      clubId: _clubId,
    }: {
      bookingId: string;
      sessionId: string;
      clubId: string;
    }) => {
      const res = await apiFetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'member_request' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Stornierung fehlgeschlagen');
      }

      return res.json();
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.sessions(variables.clubId) });

      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(QUERY_KEYS.sessions(variables.clubId));

      // Optimistically update
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: Session[] | undefined) =>
          old?.map((s: Session) =>
            s.id === variables.sessionId
              ? { ...s, bookedByUser: false, bookingStatus: 'cancelled' }
              : s
          ) || []
      );

      return { previousSessions };
    },
    onSuccess: () => {
      toast.success('Buchung storniert');
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(QUERY_KEYS.sessions(variables.clubId), context.previousSessions);
      }
      toast.error(error instanceof Error ? error.message : 'Stornierung fehlgeschlagen');
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions(variables.clubId) });
    },
  });
}

// ── Warteliste ────────────────────────────────────────────────────────────────

export function useWaitlistPosition(sessionId: string | null) {
  return useQuery({
    queryKey: ['waitlist', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await apiFetch(`/api/sessions/${sessionId}/waitlist`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.entry as { id: string; position: number; created_at: string } | null;
    },
    enabled: !!sessionId,
    staleTime: STALE_TIMES.SHORT,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, clubId }: { sessionId: string; clubId: string }) => {
      const res = await apiFetch(`/api/sessions/${sessionId}/waitlist`, {
        method: 'POST',
        body: JSON.stringify({ clubId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Warteliste fehlgeschlagen');
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['waitlist', variables.sessionId] });
      toast.success('Du stehst auf der Warteliste');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Fehler bei der Warteliste');
    },
  });
}

export function useLeaveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const res = await apiFetch(`/api/sessions/${sessionId}/waitlist`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data) || 'Warteliste verlassen fehlgeschlagen');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['waitlist', variables.sessionId] });
      toast.success('Von der Warteliste entfernt');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Fehler');
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      status,
      clubId: _clubId,
    }: {
      bookingId: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
      clubId: string;
    }) => {
      const res = await apiFetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Statusaktualisierung fehlgeschlagen');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: Session[] | undefined) =>
          old?.map((s: Session) =>
            s.bookingId === variables.bookingId ? { ...s, bookingStatus: variables.status } : s
          ) || []
      );
      const statusLabels: Record<string, string> = {
        confirmed: 'Bestätigt',
        cancelled: 'Storniert',
        no_show: 'Nicht erschienen',
        pending: 'Ausstehend',
      };
      toast.success(`Status geändert zu ${statusLabels[variables.status]}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Fehler');
    },
  });
}
