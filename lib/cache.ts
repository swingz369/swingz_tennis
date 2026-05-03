import { QueryClient } from '@tanstack/react-query';

export const CACHE_TIMES = {
  IMMEDIATE: 0,
  SHORT: 1000 * 60, // 1 minute
  MEDIUM: 1000 * 60 * 5, // 5 minutes
  LONG: 1000 * 60 * 15, // 15 minutes
  VERY_LONG: 1000 * 60 * 60, // 1 hour
  DAY: 1000 * 60 * 60 * 24, // 24 hours
};

export const STALE_TIMES = {
  IMMEDIATE: 0,
  SHORT: 1000 * 30, // 30 seconds
  MEDIUM: 1000 * 60 * 2, // 2 minutes
  LONG: 1000 * 60 * 5, // 5 minutes
  VERY_LONG: 1000 * 60 * 15, // 15 minutes
};

export const QUERY_KEYS = {
  // User data
  user: ['user'] as const,
  userClub: (clubId: string) => ['user', 'club', clubId] as const,
  userMember: (memberId: string) => ['user', 'member', memberId] as const,
  userRoles: (userId: string) => ['user', 'roles', userId] as const,

  // Dashboard
  dashboardKPIs: (clubId: string) => ['dashboard', 'kpis', clubId] as const,

  // Sessions
  sessions: (clubId: string) => ['sessions', clubId] as const,
  session: (sessionId: string) => ['session', sessionId] as const,

  // Bookings
  bookings: (clubId: string) => ['bookings', clubId] as const,
  booking: (bookingId: string) => ['booking', bookingId] as const,

  // Schedule
  schedule: (clubId: string) => ['schedule', clubId] as const,

  // Members
  members: (clubId: string) => ['members', clubId] as const,
  member: (memberId: string) => ['member', memberId] as const,

  // Clubs
  clubs: () => ['clubs'] as const,
  club: (clubId: string) => ['club', clubId] as const,

  // Analytics
  analytics: (clubId: string) => ['analytics', clubId] as const,

  // Trainers
  trainers: (clubId: string) => ['trainers', clubId] as const,
  trainer: (trainerId: string) => ['trainer', trainerId] as const,

  // Courts
  courts: (clubId: string) => ['courts', clubId] as const,
  court: (courtId: string) => ['court', courtId] as const,
};

export function invalidateQueries(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.invalidateQueries({ queryKey: key });
}

export function setQueryData<T>(queryClient: QueryClient, key: readonly unknown[], data: T) {
  return queryClient.setQueryData(key, data);
}

export function getQueryData<T>(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.getQueryData<T>(key);
}

export function prefetchQuery<T>(
  queryClient: QueryClient,
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options?: { staleTime?: number }
) {
  return queryClient.prefetchQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime: options?.staleTime || STALE_TIMES.MEDIUM,
  });
}

export function cancelQueries(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.cancelQueries({ queryKey: key });
}

export function resetQueries(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.resetQueries({ queryKey: key });
}

export function clearQueries(queryClient: QueryClient) {
  return queryClient.clear();
}

export function getQueryCache(queryClient: QueryClient) {
  return queryClient.getQueryCache();
}

export function getMutationCache(queryClient: QueryClient) {
  return queryClient.getMutationCache();
}
