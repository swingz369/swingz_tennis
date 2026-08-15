import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/cache';
import { apiFetch } from '@/lib/api-fetch';

export function useSeasonPlanGrid(seasonId: string | null) {
  return useQuery({
    queryKey: ['season-plan-grid', seasonId],
    queryFn: async () => {
      if (!seasonId) return { slots: [], groups: [], courts: [] };
      const res = await apiFetch(`/api/seasons/${seasonId}/plan-grid`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Saisonplan konnte nicht geladen werden');
      }
      return res.json();
    },
    enabled: !!seasonId,
    staleTime: STALE_TIMES.SHORT,
  });
}
