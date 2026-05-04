import type { QueryClient } from '@tanstack/react-query';
import { prefetchQuery, QUERY_KEYS, STALE_TIMES } from './cache';

export async function prefetchCommonData(queryClient: QueryClient, clubId: string) {
  try {
    await Promise.all([
      prefetchQuery(
        queryClient,
        QUERY_KEYS.dashboardKPIs(clubId),
        async () => {
          const res = await fetch(`/api/dashboard/kpis?clubId=${clubId}`);
          if (!res.ok) throw new Error('Failed to fetch KPIs');
          return res.json();
        },
        { staleTime: STALE_TIMES.MEDIUM }
      ),
      prefetchQuery(
        queryClient,
        QUERY_KEYS.sessions(clubId),
        async () => {
          const res = await fetch(`/api/sessions?clubId=${clubId}`);
          if (!res.ok) throw new Error('Failed to fetch sessions');
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        },
        { staleTime: STALE_TIMES.SHORT }
      ),
      prefetchQuery(
        queryClient,
        QUERY_KEYS.schedule(clubId),
        async () => {
          const res = await fetch(`/api/schedule?clubId=${clubId}`);
          if (!res.ok) throw new Error('Failed to fetch schedule');
          return res.json();
        },
        { staleTime: STALE_TIMES.MEDIUM }
      ),
    ]);
  } catch (error) {
    console.error('Error prefetching common data:', error);
  }
}

export async function prefetchMemberData(queryClient: QueryClient, memberId: string) {
  try {
    await prefetchQuery(
      queryClient,
      QUERY_KEYS.member(memberId),
      async () => {
        const res = await fetch(`/api/members/${memberId}`);
        if (!res.ok) throw new Error('Failed to fetch member');
        return res.json();
      },
      { staleTime: STALE_TIMES.LONG }
    );
  } catch (error) {
    console.error('Error prefetching member data:', error);
  }
}

export async function prefetchAnalyticsData(queryClient: QueryClient, clubId: string) {
  try {
    await prefetchQuery(
      queryClient,
      QUERY_KEYS.analytics(clubId),
      async () => {
        const res = await fetch(`/api/analytics?clubId=${clubId}`);
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
      },
      { staleTime: STALE_TIMES.LONG }
    );
  } catch (error) {
    console.error('Error prefetching analytics data:', error);
  }
}

export async function prefetchBookingsData(queryClient: QueryClient, clubId: string) {
  try {
    await prefetchQuery(
      queryClient,
      QUERY_KEYS.bookings(clubId),
      async () => {
        const res = await fetch(`/api/bookings?clubId=${clubId}`);
        if (!res.ok) throw new Error('Failed to fetch bookings');
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { staleTime: STALE_TIMES.SHORT }
    );
  } catch (error) {
    console.error('Error prefetching bookings data:', error);
  }
}

export function createPrefetchHandler(
  queryClient: QueryClient,
  prefetchFn: (queryClient: QueryClient, ...args: any[]) => Promise<void>
) {
  return (...args: any[]) => {
    prefetchFn(queryClient, ...args).catch((error) => {
      console.error('Prefetch error:', error);
    });
  };
}
