import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export function useDashboardKpis(clubIdParam?: string) {
  const searchParams = useSearchParams();
  const clubId = clubIdParam || searchParams.get('clubId') || '';

  return useQuery({
    queryKey: QUERY_KEYS.dashboardKPIs(clubId),
    queryFn: async () => {
      if (!clubId) {
        return {
          activeMembers: 0,
          activeTrainers: 0,
          sessionsToday: 0,
          pendingBookings: 0,
          totalCourts: 0,
        };
      }
      const res = await fetch(`/api/dashboard/kpis?clubId=${clubId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard KPIs');
      }
      return res.json();
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.MEDIUM,
  });
}
