import { extractErrorMessage } from '@/lib/typed-helpers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { STALE_TIMES } from '@/lib/cache';
import { apiFetch } from '@/lib/api-fetch';

export interface Rsvp {
  id: string;
  sessionId: string;
  memberId: string;
  status: 'accepted' | 'declined' | 'maybe' | 'pending';
  respondedAt: string | null;
  notes?: string;
  session?: {
    id: string;
    timeslotStart: string;
    timeslotEnd: string;
    courtName: string;
    trainerName: string;
    maxParticipants: number;
  };
  user?: {
    fullName?: string;
    avatarUrl?: string;
  };
}

export function useSessionRsvps(sessionId: string | null) {
  return useQuery({
    queryKey: ['rsvps', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await apiFetch(`/api/sessions/${sessionId}/rsvp`, { credentials: 'include' });
      if (!res.ok) throw new Error('Teilnahmen konnten nicht geladen werden');
      const data = await res.json();
      return (data.rsvps || []) as Rsvp[];
    },
    enabled: !!sessionId,
    staleTime: STALE_TIMES.SHORT,
  });
}

export function useSubmitRsvp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      status,
      notes,
    }: {
      sessionId: string;
      status: 'accepted' | 'declined' | 'maybe';
      notes?: string;
    }) => {
      const res = await apiFetch(`/api/sessions/${sessionId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'RSVP fehlgeschlagen');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const labels: Record<string, string> = {
        accepted: 'Teilnahme bestätigt ✅',
        declined: 'Absage erhalten',
        maybe: 'Vielleicht notiert',
      };
      toast.success(labels[variables.status] || 'RSVP gespeichert');
      // Invalidate both my rsvps and session rsvps
      queryClient.invalidateQueries({ queryKey: ['rsvps', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['rsvps', 'session', variables.sessionId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'RSVP fehlgeschlagen');
    },
  });
}
