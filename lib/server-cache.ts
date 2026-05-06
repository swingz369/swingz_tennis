/**
 * Server-side caching utilities with revalidatePath and revalidateTag
 * Based on TSOWAPP caching strategy
 */

export const REVALIDATE_TIMES = {
  NONE: false, // No caching
  DEFAULT: undefined, // Default Next.js behavior
  SHORT: 30, // 30 seconds
  MEDIUM: 60, // 1 minute
  LONG: 300, // 5 minutes
  VERY_LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

/**
 * Cache tags for Next.js revalidation
 * Use these with revalidateTag() after mutations
 */
export const CACHE_TAGS = {
  // User-related
  user: (userId: string) => `user-${userId}`,
  userRoles: (userId: string) => `user-roles-${userId}`,
  userMemberships: (userId: string) => `user-memberships-${userId}`,

  // Club-related
  club: (clubId: string) => `club-${clubId}`,
  clubs: () => 'clubs-all',
  clubMembers: (clubId: string) => `club-members-${clubId}`,

  // Courts
  courts: (clubId: string) => `courts-${clubId}`,
  court: (courtId: string) => `court-${courtId}`,
  courtAvailability: (courtId: string, date: string) => `court-availability-${courtId}-${date}`,

  // Bookings
  bookings: (clubId: string) => `bookings-${clubId}`,
  booking: (bookingId: string) => `booking-${bookingId}`,
  bookingsByUser: (userId: string) => `bookings-user-${userId}`,
  bookingsByDate: (clubId: string, date: string) => `bookings-${clubId}-${date}`,

  // Sessions & Schedule
  sessions: (clubId: string) => `sessions-${clubId}`,
  session: (sessionId: string) => `session-${sessionId}`,
  schedule: (clubId: string) => `schedule-${clubId}`,
  trainingSchedule: (clubId: string) => `training-schedule-${clubId}`,

  // Members
  members: (clubId: string) => `members-${clubId}`,
  member: (memberId: string) => `member-${memberId}`,

  // Trainers
  trainers: (clubId: string) => `trainers-${clubId}`,
  trainer: (trainerId: string) => `trainer-${trainerId}`,
  trainerAvailability: (trainerId: string) => `trainer-availability-${trainerId}`,

  // Attendance
  attendance: (sessionId: string) => `attendance-${sessionId}`,
  attendanceByUser: (userId: string) => `attendance-user-${userId}`,

  // Analytics & Dashboard
  dashboardKPIs: (clubId: string) => `dashboard-kpis-${clubId}`,
  analytics: (clubId: string) => `analytics-${clubId}`,

  // Settings
  settings: (clubId: string) => `settings-${clubId}`,
  bookingRules: (clubId: string) => `booking-rules-${clubId}`,

  // News & Communication
  news: (clubId: string) => `news-${clubId}`,
  newsItem: (newsId: string) => `news-item-${newsId}`,

  // Approvals
  approvals: (clubId: string) => `approvals-${clubId}`,
  approval: (approvalId: string) => `approval-${approvalId}`,
} as const;

/**
 * Common cache configurations for different data types
 */
export const CACHE_CONFIGS = {
  // Static or rarely changing data
  static: {
    revalidate: REVALIDATE_TIMES.DAY,
    tags: [] as string[],
  },

  // Settings and configuration
  settings: {
    revalidate: REVALIDATE_TIMES.HOUR,
    tags: [] as string[],
  },

  // User profile data
  profile: {
    revalidate: REVALIDATE_TIMES.LONG,
    tags: [] as string[],
  },

  // List data (members, bookings, etc.)
  list: {
    revalidate: REVALIDATE_TIMES.MEDIUM,
    tags: [] as string[],
  },

  // Dashboard and analytics
  dashboard: {
    revalidate: REVALIDATE_TIMES.SHORT,
    tags: [] as string[],
  },

  // Real-time or frequently changing data
  realtime: {
    revalidate: REVALIDATE_TIMES.SHORT,
    tags: [] as string[],
  },

  // No caching for sensitive operations
  nocache: {
    revalidate: REVALIDATE_TIMES.NONE,
    tags: [] as string[],
  },
} as const;

/**
 * Helper to create cache config with tags
 */
export function createCacheConfig(revalidate: number | false, tags: string[]) {
  return {
    revalidate,
    tags,
  };
}

/**
 * Common fetch options for different scenarios
 */
export const FETCH_OPTIONS = {
  // Force fresh data on every request
  noStore: {
    cache: 'no-store' as const,
  },

  // Default Next.js caching
  default: {
    cache: 'force-cache' as const,
  },

  // Revalidate after time period
  revalidate: (seconds: number) => ({
    next: { revalidate: seconds },
  }),

  // Tag-based revalidation
  tags: (tags: string[]) => ({
    next: { tags },
  }),

  // Combined time + tags
  revalidateAndTags: (seconds: number, tags: string[]) => ({
    next: {
      revalidate: seconds,
      tags,
    },
  }),
} as const;

/**
 * Typed wrapper for Supabase queries with caching
 *
 * Usage:
 * ```ts
 * const { data } = await supabase
 *   .from('bookings')
 *   .select('*')
 *   .eq('club_id', clubId)
 *   .returns<Booking[]>();
 *
 * // Apply caching with tags
 * const cached = withCache(data, CACHE_TAGS.bookings(clubId));
 * ```
 */
export function withCache<T>(data: T, ...tags: string[]) {
  return {
    data,
    tags,
    config: createCacheConfig(REVALIDATE_TIMES.MEDIUM, tags),
  };
}

/**
 * Example usage patterns:
 *
 * // In a server component or route handler:
 * import { CACHE_TAGS, REVALIDATE_TIMES } from '@/lib/server-cache';
 * import { revalidateTag } from 'next/cache';
 *
 * // Fetch with caching
 * export async function getClubBookings(clubId: string) {
 *   const { data } = await supabase
 *     .from('bookings')
 *     .select('*')
 *     .eq('club_id', clubId);
 *
 *   return data;
 * }
 *
 * // In a server action after mutation:
 * export async function createBooking(booking: NewBooking) {
 *   const { data } = await supabase
 *     .from('bookings')
 *     .insert(booking)
 *     .select()
 *     .single();
 *
 *   // Revalidate relevant caches
 *   revalidateTag(CACHE_TAGS.bookings(booking.club_id));
 *   revalidateTag(CACHE_TAGS.bookingsByUser(booking.user_id));
 *   revalidateTag(CACHE_TAGS.bookingsByDate(booking.club_id, booking.date));
 *
 *   return data;
 * }
 */
