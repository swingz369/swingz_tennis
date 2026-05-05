import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { analytics } from '@/lib/analytics';
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
}

export interface ScheduleData {
  scheduleId: string;
  clubId: string;
  sessions: Session[];
}

export function useSchedule(clubId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.schedule(clubId),
    queryFn: async () => {
      const res = await fetch(`/api/schedule?clubId=${clubId}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load schedule');
      }
      return res.json() as Promise<ScheduleData>;
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      sessions,
      clubId,
    }: {
      scheduleId: string;
      sessions: Session[];
      clubId: string;
    }) => {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          clubId,
          sessions: sessions.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            trainerId: s.trainerId,
            groupIds: s.groupIds,
            maxParticipants: s.maxParticipants,
            notes: s.notes,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Update failed');
      }

      return res.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.schedule(variables.clubId) });

      const previousSchedule = queryClient.getQueryData<ScheduleData>(
        QUERY_KEYS.schedule(variables.clubId)
      );

      queryClient.setQueryData<ScheduleData>(QUERY_KEYS.schedule(variables.clubId), (old) =>
        old
          ? { ...old, sessions: variables.sessions }
          : {
              scheduleId: variables.scheduleId,
              clubId: variables.clubId,
              sessions: variables.sessions,
            }
      );

      return { previousSchedule };
    },
    onError: (_error, variables, context) => {
      if (context?.previousSchedule) {
        queryClient.setQueryData(QUERY_KEYS.schedule(variables.clubId), context.previousSchedule);
      }
      toast.error('Fehler beim Speichern');
    },
    onSuccess: () => {
      toast.success('Termin verschoben');
    },
  });
}

export function useOptimizeSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId }: { clubId: string }) => {
      const res = await fetch('/api/schedule/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Optimization failed');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      if (data.schedule) {
        queryClient.setQueryData(QUERY_KEYS.schedule(variables.clubId), data.schedule);
      }
      toast.success('Stundenplan optimiert');
      analytics.scheduleOptimized(variables.clubId);
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : 'Optimierung fehlgeschlagen';
      toast.error(message);
      analytics.trackEvent('schedule_optimize_failed', {
        error: message,
        clubId: variables.clubId,
      });
    },
  });
}
