/**
 * lib/cache.ts — Client-Safe Cache Constants
 *
 * Provides React Query cache keys and stale time presets.
 * This file must NOT import server-only APIs (next/cache, revalidateTag, etc.)
 * because it is imported by client-side hooks (use-courts, use-sessions, etc.).
 *
 * Server-side caching (unstable_cache, revalidateTag) lives in
 * lib/server-cache.ts and lib/utils/revalidation.ts.
 */

// ═══════════════════════════════════════════════════════════════════════════
// React Query Cache Keys & Stale Times (used by hooks/use-*.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Centralized React Query keys for consistent cache invalidation.
 * Used by client-side hooks (use-courts, use-sessions, etc.)
 */
export const QUERY_KEYS = {
  courts: (clubId: string) => ['courts', clubId] as const,
  sessions: (clubId: string) => ['sessions', clubId] as const,
  schedule: (clubId: string) => ['schedule', clubId] as const,
  userClub: (userId: string) => ['user-club', userId] as const,
  userMember: (userId: string) => ['user-member', userId] as const,
  userRoles: (userId: string) => ['user-roles', userId] as const,
  members: (clubId: string) => ['members', clubId] as const,
  trainers: (clubId: string) => ['trainers', clubId] as const,
  bookings: (clubId: string) => ['bookings', clubId] as const,
  invoices: (clubId: string) => ['invoices', clubId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
} as const;

/**
 * Cache time presets for React Query gcTime (in milliseconds).
 * gcTime should be >= staleTime for correct cache behaviour.
 */
export const CACHE_TIMES = {
  IMMEDIATE: 0,
  SHORT: 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 10 * 60 * 1000,
  VERY_LONG: 30 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Stale time presets for React Query (in milliseconds).
 */
export const STALE_TIMES = {
  IMMEDIATE: 0,
  /** 30 seconds — for rapidly changing data (sessions, bookings) */
  SHORT: 30 * 1000,
  /** 2 minutes — for moderately changing data (courts, schedule) */
  MEDIUM: 2 * 60 * 1000,
  /** 5 minutes — for rarely changing data (user profile, club settings) */
  LONG: 5 * 60 * 1000,
  VERY_LONG: 10 * 60 * 1000,
} as const;
