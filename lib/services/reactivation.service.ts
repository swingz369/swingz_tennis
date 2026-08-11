/**
 * lib/services/reactivation.service.ts
 *
 * Sprint 4 Q2 — Ticket 2.5.2 (Inaktivitäts-Reaktivierung)
 *
 * Daily cron (vercel.json `0 9 * * *`) finds members with no booking in the last
 * INACTIVITY_THRESHOLD_DAYS (14) days, sends them a reactivation push notification,
 * and marks the membership so we don't spam them.
 *
 * Idempotency:
 *   - `last_reactivation_sent_at` on user_club_memberships is checked against
 *     REACTIVATION_COOLDOWN_DAYS (14). A member only gets one push per 14 days.
 *
 * "Inactive" definition (per ticket spec):
 *   - No booking in last 14 days AND no recent reactivation push.
 *   - Has at least one confirmed/completed booking ever (skips never-active users
 *     to avoid pushing people who just signed up).
 *
 * Architecture (per codebase conventions, see lib/match-completion-push.service.ts):
 *   - Pure functions for testability (buildReactivationPayload, shouldReactivate,
 *     filterInactiveMembers).
 *   - Service class for orchestration (runReactivation) that calls pure functions
 *     + DB queries + push service.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { pushNotificationService, type PushPayload } from '@/lib/push-notification.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('service:reactivation');

// ─── Constants ────────────────────────────────────────────────────────

export const INACTIVITY_THRESHOLD_DAYS = 14;
export const REACTIVATION_COOLDOWN_DAYS = 14;
// Lookback must be wider than threshold so "never booked" detection works.
// Derived from threshold (×4 buffer) so the two constants can't drift apart.
const BOOKING_LOOKBACK_DAYS = INACTIVITY_THRESHOLD_DAYS * 4;

// ─── Types ────────────────────────────────────────────────────────────

export interface InactiveMember {
  userId: string;
  clubId: string;
  fullName: string | null;
  daysSinceLastBooking: number | null;
  lastReactivationSentAt: string | null;
  reactivationCount: number;
}

export interface ReactivationResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ userId: string; error: string }>;
}

// ─── Pure helpers (testable without DB) ──────────────────────────────

/** Number of full days between two ISO timestamps. Returns null if `from` is null. */
export function daysBetween(from: string | null, to: Date = new Date()): number | null {
  if (!from) return null;
  const ms = to.getTime() - new Date(from).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Is this member eligible for a reactivation push right now? */
export function shouldReactivate(member: InactiveMember, now: Date = new Date()): boolean {
  // Inactive: trust the daysSinceLastBooking snapshot precomputed by
  // findInactiveMembers (with the same `now` we're called with in runReactivation).
  // Avoids recomputing via daysBetween(lastBookingAt, now) — single source of truth.
  if (
    member.daysSinceLastBooking !== null &&
    member.daysSinceLastBooking < INACTIVITY_THRESHOLD_DAYS
  ) {
    return false;
  }
  // Cooldown: don't re-push within REACTIVATION_COOLDOWN_DAYS of last send
  const sinceLastSent = daysBetween(member.lastReactivationSentAt, now);
  if (sinceLastSent !== null && sinceLastSent < REACTIVATION_COOLDOWN_DAYS) {
    return false;
  }
  return true;
}

/** Compose the push notification payload for a single member. `appUrl` is required
 *  (caller in runReactivation reads process.env.NEXT_PUBLIC_APP_URL) — pass '' for
 *  relative paths during testing. */
export function buildReactivationPayload(member: InactiveMember, appUrl: string): PushPayload {
  const days = member.daysSinceLastBooking ?? INACTIVITY_THRESHOLD_DAYS;
  const firstName = member.fullName?.split(' ')[0] ?? 'Hallo';
  return {
    title: `${firstName}, wir vermissen dich! 🎾`,
    body: `Es ist ${days} Tage her seit deiner letzten Buchung. Schau dir die neuen Trainingszeiten an!`,
    url: `${appUrl}/bookings`,
    tag: `reactivation-${member.userId}`,
    data: {
      type: 'reactivation',
      userId: member.userId,
      clubId: member.clubId,
      daysSinceLastBooking: days,
    },
  };
}

// ─── Service class ────────────────────────────────────────────────────

export class ReactivationService {
  /**
   * Run the daily reactivation flow.
   * - Find inactive members
   * - Send reactivation push (per-member try/catch)
   * - Mark memberships on successful send
   *
   * Idempotent: safe to run multiple times per day.
   */
  static async runReactivation(): Promise<ReactivationResult> {
    const result: ReactivationResult = {
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const supabase = createServiceClient();
    const now = new Date();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    let members: InactiveMember[];
    try {
      members = await this.findInactiveMembers(supabase, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to find inactive members', { error: message });
      result.errors.push({ userId: '*', error: `findInactiveMembers: ${message}` });
      return result;
    }

    result.total = members.length;
    log.info(`Found ${members.length} candidate members for reactivation`);

    for (const member of members) {
      if (!shouldReactivate(member, now)) {
        result.skipped++;
        continue;
      }

      try {
        const payload = buildReactivationPayload(member, appUrl);
        const sendResult = await pushNotificationService.sendToUser(member.userId, payload);

        if (sendResult.sent > 0) {
          // Mark reactivation sent (best-effort — audit-style, don't fail the run)
          const { error: updateError } = await supabase
            .from('user_club_memberships')
            .update({
              last_reactivation_sent_at: now.toISOString(),
              reactivation_count: member.reactivationCount + 1,
            })
            .eq('user_id', member.userId)
            .eq('club_id', member.clubId);

          if (updateError) {
            // Push went out but mark failed — log warn, count as failed for visibility
            log.warn('Push sent but mark-sent failed', {
              userId: member.userId,
              error: updateError.message,
            });
            result.failed++;
            result.errors.push({
              userId: member.userId,
              error: `markSent: ${updateError.message}`,
            });
          } else {
            result.sent++;
            log.info('Reactivation push sent', {
              userId: member.userId,
              daysSinceLastBooking: member.daysSinceLastBooking,
              reactivationCount: member.reactivationCount + 1,
            });
          }
        } else {
          // No active push subscription for this user → skip silently
          result.skipped++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.failed++;
        result.errors.push({ userId: member.userId, error: message });
        log.error('Reactivation push failed', { userId: member.userId, error: message });
      }
    }

    log.info('Reactivation run complete', {
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });

    return result;
  }

  /**
   * Find members who:
   *   1. Have an active membership (is_active = true)
   *   2. Have at least one confirmed/completed booking ever (skips brand-new users)
   *   3. No booking in last INACTIVITY_THRESHOLD_DAYS days
   *
   * The cooldown check is applied in shouldReactivate (not here) so that the
   * service can also return members who are in cooldown for monitoring purposes.
   */
  private static async findInactiveMembers(
    supabase: ReturnType<typeof createServiceClient>,
    now: Date
  ): Promise<InactiveMember[]> {
    // 1. Get all active memberships + user name in one query
    const { data: memberships, error: membershipsError } = await supabase
      .from('user_club_memberships')
      .select(
        'user_id, club_id, last_reactivation_sent_at, reactivation_count, users!user_club_memberships_user_id_fkey(full_name)'
      )
      .eq('is_active', true)
      .in('role', ['member', 'trainer', 'admin']);

    if (membershipsError) throw membershipsError;
    if (!memberships || memberships.length === 0) return [];

    const userIds = [...new Set(memberships.map((m: any) => m.user_id))];

    // 2. Get recent bookings for those users (BOOKING_LOOKBACK_DAYS window)
    const lookbackCutoff = new Date(
      now.getTime() - BOOKING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('member_id, created_at')
      .in('member_id', userIds)
      .gte('created_at', lookbackCutoff)
      .in('status', ['confirmed', 'completed']);

    if (bookingsError) throw bookingsError;

    // 3. Index bookings by user (keep the most recent)
    const lastBookingByUser = new Map<string, string>();
    for (const b of bookings ?? []) {
      const existing = lastBookingByUser.get(b.member_id);
      if (!existing || b.created_at > existing) {
        lastBookingByUser.set(b.member_id, b.created_at);
      }
    }

    // 4. Compute inactive members
    const inactive: InactiveMember[] = [];
    for (const m of memberships as any[]) {
      const user = Array.isArray(m.users) ? m.users[0] : m.users;
      const lastBookingAt = lastBookingByUser.get(m.user_id) ?? null;

      // Skip brand-new users (never booked) — we don't want to push people who just signed up
      if (!lastBookingAt) continue;

      const daysSinceLastBooking = daysBetween(lastBookingAt, now);
      if (daysSinceLastBooking === null || daysSinceLastBooking < INACTIVITY_THRESHOLD_DAYS) {
        continue; // still active
      }

      inactive.push({
        userId: m.user_id,
        clubId: m.club_id,
        fullName: user?.full_name ?? null,
        daysSinceLastBooking,
        lastReactivationSentAt: m.last_reactivation_sent_at,
        reactivationCount: m.reactivation_count ?? 0,
      });
    }

    return inactive;
  }
}
