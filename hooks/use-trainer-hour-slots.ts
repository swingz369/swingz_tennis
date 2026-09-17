import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';

/**
 * Trainerstunden (private Einzelstunden, `trainer_availabilities`) als vierte
 * Slot-Quelle des Platzkalenders — Sanierungsplan Phase 2.1.2. Anders als
 * Sessions/Planeinträge/Sperren hängen diese Slots an keinem Platz, deshalb
 * erscheinen sie nicht als Rasterzelle, sondern als eigene, visuell
 * unterscheidbare Liste (siehe components/calendar/trainer-hour-slots.tsx).
 */
export interface TrainerHourSlot {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: 'available' | 'booked';
}

interface RawSlot {
  id: string;
  trainer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
  trainers: { id: string; name: string; email: string } | null;
}

export function useTrainerHourSlots(clubId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['trainer-hour-slots', clubId, from, to],
    queryFn: async (): Promise<TrainerHourSlot[]> => {
      const res = await apiFetch(
        `/api/trainer/availability?from=${from}T00:00:00Z&to=${to}T23:59:59Z`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return ((data.slots ?? []) as RawSlot[]).map((s) => ({
        id: s.id,
        trainerId: s.trainer_id,
        trainerName: s.trainers?.name ?? 'Trainer',
        date: s.date.substring(0, 10),
        startTime: s.start_time.substring(0, 5),
        endTime: s.end_time.substring(0, 5),
        status: s.status,
      }));
    },
    enabled: !!clubId,
    staleTime: 60_000,
  });
}

export function useBookTrainerHourSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slot: TrainerHourSlot) => {
      const res = await apiFetch('/api/trainer/book', {
        method: 'POST',
        body: JSON.stringify({
          trainerId: slot.trainerId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Buchung fehlgeschlagen');
      return data;
    },
    onSuccess: () => {
      toast.success('Trainerstunde gebucht');
      void queryClient.invalidateQueries({ queryKey: ['trainer-hour-slots'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Buchung fehlgeschlagen');
    },
  });
}

export function useWaitlistTrainerHourSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slot: TrainerHourSlot) => {
      const res = await apiFetch('/api/trainer/waitlist', {
        method: 'POST',
        body: JSON.stringify({ slotId: slot.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Warteliste fehlgeschlagen');
      return data;
    },
    onSuccess: () => {
      toast.success('Auf der Warteliste eingetragen');
      void queryClient.invalidateQueries({ queryKey: ['trainer-hour-slots'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Warteliste fehlgeschlagen');
    },
  });
}
