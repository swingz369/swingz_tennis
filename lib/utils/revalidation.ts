/**
 * Cache revalidation utilities for server actions
 * Centralized helpers for invalidating Next.js cache after mutations
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/server-cache';

/**
 * Revalidate all booking-related caches for a club
 */
export function revalidateBookings(clubId: string, additionalTags?: string[]) {
  revalidateTag(CACHE_TAGS.bookings(clubId));
  revalidateTag(CACHE_TAGS.dashboardKPIs(clubId));
  revalidatePath('/bookings');
  revalidatePath('/dashboard');

  additionalTags?.forEach((tag) => revalidateTag(tag));
}

/**
 * Revalidate all session-related caches
 */
export function revalidateSessions(clubId: string, sessionId?: string) {
  revalidateTag(CACHE_TAGS.sessions(clubId));
  revalidateTag(CACHE_TAGS.trainingSchedule(clubId));

  if (sessionId) {
    revalidateTag(CACHE_TAGS.session(sessionId));
    revalidateTag(CACHE_TAGS.attendance(sessionId));
  }

  revalidatePath('/training-schedule');
  revalidatePath('/trainer');
}

/**
 * Revalidate member-related caches
 */
export function revalidateMembers(clubId: string, memberId?: string) {
  revalidateTag(CACHE_TAGS.members(clubId));
  revalidateTag(CACHE_TAGS.clubMembers(clubId));

  if (memberId) {
    revalidateTag(CACHE_TAGS.member(memberId));
  }

  revalidatePath('/admin/members');
  revalidatePath('/profile');
}

/**
 * Revalidate trainer-related caches
 */
export function revalidateTrainers(clubId: string, trainerId?: string) {
  revalidateTag(CACHE_TAGS.trainers(clubId));

  if (trainerId) {
    revalidateTag(CACHE_TAGS.trainer(trainerId));
    revalidateTag(CACHE_TAGS.trainerAvailability(trainerId));
  }

  revalidatePath('/trainer');
  revalidatePath('/admin/schedules');
}

/**
 * Revalidate court-related caches
 */
export function revalidateCourts(clubId: string, courtId?: string) {
  revalidateTag(CACHE_TAGS.courts(clubId));

  if (courtId) {
    revalidateTag(CACHE_TAGS.court(courtId));
  }

  revalidatePath('/courts');
  revalidatePath('/admin/courts/manage');
}

/**
 * Revalidate club-related caches
 */
export function revalidateClub(clubId: string) {
  revalidateTag(CACHE_TAGS.club(clubId));
  revalidateTag(CACHE_TAGS.settings(clubId));
  revalidateTag(CACHE_TAGS.bookingRules(clubId));

  revalidatePath('/dashboard');
  revalidatePath('/admin/settings');
}

/**
 * Revalidate dashboard and analytics
 */
export function revalidateDashboard(clubId: string) {
  revalidateTag(CACHE_TAGS.dashboardKPIs(clubId));
  revalidateTag(CACHE_TAGS.analytics(clubId));

  revalidatePath('/dashboard');
  revalidatePath('/admin/panel-v2');
}

/**
 * Revalidate user-specific caches
 */
export function revalidateUser(userId: string) {
  revalidateTag(CACHE_TAGS.user(userId));
  revalidateTag(CACHE_TAGS.userRoles(userId));
  revalidateTag(CACHE_TAGS.userMemberships(userId));
  revalidateTag(CACHE_TAGS.bookingsByUser(userId));
  revalidateTag(CACHE_TAGS.attendanceByUser(userId));

  revalidatePath('/profile');
  revalidatePath('/dashboard');
}

/**
 * Revalidate news and communication
 */
export function revalidateNews(clubId: string, newsId?: string) {
  revalidateTag(CACHE_TAGS.news(clubId));

  if (newsId) {
    revalidateTag(CACHE_TAGS.newsItem(newsId));
  }

  revalidatePath('/news');
  revalidatePath('/dashboard');
}

/**
 * Revalidate approval-related caches
 */
export function revalidateApprovals(clubId: string, approvalId?: string) {
  revalidateTag(CACHE_TAGS.approvals(clubId));

  if (approvalId) {
    revalidateTag(CACHE_TAGS.approval(approvalId));
  }

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/panel-v2');
}

/**
 * Revalidate everything - use sparingly for major changes
 */
export function revalidateAll(clubId: string) {
  revalidateTag(CACHE_TAGS.clubs());
  revalidateClub(clubId);
  revalidateBookings(clubId);
  revalidateSessions(clubId);
  revalidateMembers(clubId);
  revalidateTrainers(clubId);
  revalidateCourts(clubId);
  revalidateDashboard(clubId);

  // Revalidate all major paths
  revalidatePath('/', 'layout');
}
