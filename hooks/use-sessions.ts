import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

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
  bookedByUser?: boolean;
  bookingId?: string;
  bookingStatus?: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
}

export function useSessions(clubId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.sessions(clubId || ''),
    queryFn: async () => {
      if (!clubId) return [];
      const res = await fetch(`/api/sessions?clubId=${clubId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.SHORT,
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
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, sessionId, clubId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Booking failed');
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: any) =>
          old?.map((s: any) =>
            s.id === variables.sessionId
              ? { ...s, bookedByUser: true, bookingId: data.bookingId }
              : s
          ) || []
      );
      toast.success('Buchung erfolgreich');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Buchung fehlgeschlagen');
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
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'member_request' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Cancellation failed');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: any) =>
          old?.map((s: any) =>
            s.id === variables.sessionId ? { ...s, bookedByUser: false } : s
          ) || []
      );
      toast.success('Buchung storniert');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Stornierung fehlgeschlagen');
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
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Status update failed');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        QUERY_KEYS.sessions(variables.clubId),
        (old: any) =>
          old?.map((s: any) =>
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
