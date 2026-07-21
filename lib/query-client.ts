/**
 * React Query Configuration
 *
 * Optimized caching and query settings for better performance
 */

import type { DefaultOptions } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';

const queryConfig: DefaultOptions = {
  queries: {
    // Cache for 5 minutes by default
    staleTime: 5 * 60 * 1000,

    // Keep data in cache for 10 minutes
    gcTime: 10 * 60 * 1000,

    // Retry failed queries 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Don't refetch on window focus in development
    refetchOnWindowFocus: process.env.NODE_ENV === 'production',

    // Refetch on reconnect
    refetchOnReconnect: true,

    // Don't refetch on mount if data is fresh
    refetchOnMount: false,
  },
  mutations: {
    // Retry mutations once
    retry: 1,
  },
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  });
}

// Query keys factory for consistency
export const queryKeys = {
  // User queries
  user: {
    all: ['user'] as const,
    me: () => [...queryKeys.user.all, 'me'] as const,
    roles: () => [...queryKeys.user.all, 'roles'] as const,
    club: () => [...queryKeys.user.all, 'club'] as const,
    member: () => [...queryKeys.user.all, 'member'] as const,
  },

  // Members queries
  members: {
    all: ['members'] as const,
    lists: () => [...queryKeys.members.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.members.lists(), filters] as const,
    details: () => [...queryKeys.members.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.members.details(), id] as const,
  },

  // Sessions queries
  sessions: {
    all: ['sessions'] as const,
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    list: (clubId: string | null) => [...queryKeys.sessions.lists(), clubId] as const,
    details: () => [...queryKeys.sessions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sessions.details(), id] as const,
  },

  // Bookings queries
  bookings: {
    all: ['bookings'] as const,
    lists: () => [...queryKeys.bookings.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.bookings.lists(), filters] as const,
    my: () => [...queryKeys.bookings.all, 'my'] as const,
  },

  // Invoices queries
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...queryKeys.invoices.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.invoices.lists(), filters] as const,
    details: () => [...queryKeys.invoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },

  // Analytics queries (longer cache)
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    insights: () => [...queryKeys.analytics.all, 'insights'] as const,
  },

  // Tenants queries (for superadmin)
  tenants: {
    all: ['tenants'] as const,
    list: () => [...queryKeys.tenants.all, 'list'] as const,
  },
} as const;
