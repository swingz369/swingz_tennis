import { QueryClient } from '@tanstack/react-query';
import { CACHE_TIMES, STALE_TIMES } from './cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.MEDIUM,
      gcTime: CACHE_TIMES.VERY_LONG,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
