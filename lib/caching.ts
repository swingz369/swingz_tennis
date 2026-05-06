/**
 * Server-Side Caching with Next.js unstable_cache
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.2
 *
 * Implements TSOWAPP's caching strategy for 10x faster dashboard loads
 * Uses revalidation tags for granular cache invalidation
 */

import { unstable_cache } from 'next/cache';
import { unstable_noStore } from 'next/cache';

/**
 * Cache TTLs based on data volatility (copied from TSOWAPP)
 *
 * Guidelines:
 * - STATIC: Data that rarely changes (clubs, courts, settings)
 * - SEMI_STATIC: Data that changes moderately (stats, counts, summaries)
 * - DYNAMIC: Data that needs fresh updates (bookings, sessions, active data)
 * - REALTIME: No caching (messages, live invoices, current state)
 */
export const CACHE_TTL = {
  STATIC: 3600, // 1 hour - clubs, courts (rarely change)
  SEMI_STATIC: 300, // 5 min - stats, counts (frequent but not critical)
  DYNAMIC: 60, // 1 min - bookings, sessions (fresh data needed)
  REALTIME: 0, // no cache - messages, invoices, live updates
} as const;

/**
 * Tagged caching helper for better cache invalidation
 *
 * @param key - Unique cache key (e.g., 'club-stats-abc123')
 * @param fetcher - Async function that fetches the data
 * @param ttl - Time to live in seconds (use CACHE_TTL constants)
 * @param tags - Tags for cache invalidation (e.g., ['club-abc123', 'stats'])
 * @returns Cached or fresh data
 *
 * @example
 * ```ts
 * const stats = await getCachedData(
 *   'club-stats-abc123',
 *   () => fetchStatsFromDB(clubId),
 *   CACHE_TTL.SEMI_STATIC,
 *   ['club-abc123', 'stats']
 * );
 * ```
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  tags?: string[]
): Promise<T> {
  // No caching for realtime data
  if (ttl === 0) {
    unstable_noStore(); // Tell Next.js to not cache this response
    return fetcher();
  }

  // Create cached version of fetcher
  const cachedFetcher = unstable_cache(
    async () => fetcher(),
    [key], // Cache key namespace
    {
      revalidate: ttl, // TTL in seconds
      tags: tags || [key], // Tags for targeted invalidation
    }
  );

  return cachedFetcher();
}

/**
 * Cache invalidation helper
 *
 * Revalidates all cache entries with the given tag
 *
 * @param tag - Tag to invalidate (e.g., 'club-abc123')
 *
 * @example
 * ```ts
 * // After creating a new member
 * await revalidateByTag('club-abc123');
 * await revalidateByTag('members');
 * ```
 */
export async function revalidateByTag(tag: string): Promise<void> {
  const { revalidateTag } = await import('next/cache');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (revalidateTag as any)(tag, 'default');
}

/**
 * Invalidate all caches for a specific club
 * Use this after any mutation that affects club data
 *
 * @param clubId - Club UUID
 */
export async function revalidateClubData(clubId: string) {
  await revalidateByTag(`club-${clubId}`);
}

/**
 * Invalidate member-related caches
 * Use this after member create/update/delete
 *
 * @param clubId - Club UUID
 */
export async function revalidateMemberData(clubId: string) {
  await revalidateByTag(`club-${clubId}`);
  await revalidateByTag('members');
}

/**
 * Invalidate booking-related caches
 * Use this after booking create/update/delete
 *
 * @param clubId - Club UUID
 */
export async function revalidateBookingData(clubId: string) {
  await revalidateByTag(`club-${clubId}`);
  await revalidateByTag('bookings');
}

/**
 * Invalidate session-related caches
 * Use this after session create/update/delete
 *
 * @param clubId - Club UUID
 */
export async function revalidateSessionData(clubId: string) {
  await revalidateByTag(`club-${clubId}`);
  await revalidateByTag('sessions');
}

/**
 * Opt out of caching for specific operations
 *
 * Use in API routes or server actions that should never be cached
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   noStore(); // Ensure this API route is never cached
 *   // ... handle request
 * }
 * ```
 */
export function noStore() {
  unstable_noStore();
}
