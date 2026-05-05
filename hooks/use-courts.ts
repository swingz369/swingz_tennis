import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export interface Court {
  id: string;
  name: string;
  surface: 'clay' | 'grass' | 'hard' | 'carpet';
  hasIndoor: boolean;
  isActive: boolean;
}

export function useCourts(clubId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.courts(clubId || ''),
    queryFn: async () => {
      if (!clubId) return [];
      const res = await fetch(`/api/courts?clubId=${clubId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch courts');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.MEDIUM,
  });
}
