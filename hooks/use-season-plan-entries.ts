import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/cache';

export interface PlanGridEntry {
  id: string;
  season_id: string;
  club_id: string;
  trainer_id: string;
  trainer_name: string;
  court_id: string | null;
  court_name: string | null;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_participants: number;
  expected_participants: string[];
  participant_count: number;
  status: string;
  entry_type: string;
}

export function useSeasonPlanEntries(seasonId: string | null) {
  return useQuery({
    queryKey: ['season-plan-entries', seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const res = await fetch(`/api/seasons/${seasonId}/plan-entries`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch season plan entries');
      }
      const data = await res.json();
      return (data.entries ?? []) as PlanGridEntry[];
    },
    enabled: !!seasonId,
    staleTime: STALE_TIMES.SHORT,
  });
}

export function useSeasonPlanGrid(seasonId: string | null) {
  return useQuery({
    queryKey: ['season-plan-grid', seasonId],
    queryFn: async () => {
      if (!seasonId) return { slots: [], groups: [], courts: [] };
      const res = await fetch(`/api/seasons/${seasonId}/plan-grid`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch season plan grid');
      }
      return res.json();
    },
    enabled: !!seasonId,
    staleTime: STALE_TIMES.SHORT,
  });
}
