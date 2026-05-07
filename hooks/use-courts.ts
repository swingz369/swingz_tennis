import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export interface Court {
  id: string;
  clubId: string;
  courtTypeId: string;
  name: string;
  number: number;
  surface: 'clay' | 'grass' | 'hard' | 'carpet' | 'artificial_grass';
  location?: string | null;
  description?: string | null;
  status?: string;
  hasLighting: boolean;
  lightingHoursStart?: string | null;
  lightingHoursEnd?: string | null;
  isActive: boolean;
  /** Derived from court_type.is_indoor — may be absent depending on API response */
  hasIndoor?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
      return Array.isArray(data) ? (data as Court[]) : [];
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.MEDIUM,
  });
}
