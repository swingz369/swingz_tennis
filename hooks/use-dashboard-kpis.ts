import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export function useDashboardKpis() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get('clubId') || '';

  return useQuery({
    queryKey: QUERY_KEYS.dashboardKPIs(clubId),
    queryFn: async () => {
      if (!clubId) {
        return { activeMembers: 0, sessionsToday: 0, pendingBookings: 0, totalCourts: 0 };
      }
      const res = await fetch(`/api/dashboard/kpis?clubId=${clubId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard KPIs');
      }
      return res.json();
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}
