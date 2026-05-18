// Season Planning Stats Service
// Computes cross-season statistics for KI recommendations

import { getDb } from '@/src/infrastructure/persistence/client';
import {
  seasonPlanEntries,
  userTrainingPreferences,
  planningConflicts,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonWaitlists,
  trainerFeedback,
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq, asc } from 'drizzle-orm';
import type { SeasonStatistics as SeasonStatsType, SlotFailureRate, CrossSeasonStats } from '@/lib/season-planning/types';

export class SeasonStatsService {
  /**
   * Compute and save statistics for a completed season
   */
  static async computeSeasonStats(seasonId: string, clubId: string): Promise<SeasonStatsType> {
    const db = getDb();

    // Load season data
    const planEntries = await db
      .select()
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, seasonId));

    const feedback = await db
      .select()
      .from(trainerFeedback)
      .where(eq(trainerFeedback.season_id, seasonId));

    const waitlist = await db
      .select()
      .from(seasonWaitlists)
      .where(eq(seasonWaitlists.season_id, seasonId));

    const conflicts = await db
      .select()
      .from(planningConflicts)
      .where(eq(planningConflicts.season_id, seasonId));

    const prefs = await db
      .select()
      .from(userTrainingPreferences)
      .where(
        and(
          eq(userTrainingPreferences.season_id, seasonId),
          eq(userTrainingPreferences.is_submitted, true)
        )
      );

    // Group performance
    const groupIds = new Set(planEntries.map((e) => e.group_id).filter(Boolean));
    const totalGroups = groupIds.size;
    const totalMembersPlanned = new Set(
      planEntries.flatMap((e) => (e.expected_participants as string[]) || [])
    ).size;
    const avgGroupSize = totalGroups > 0 ? totalMembersPlanned / totalGroups : 0;

    const groupsBelowMinSize = await this.countGroupsBelowMinSize(planEntries, clubId, seasonId);

    // Attendance metrics
    const attendanceByGroup: Record<string, number> = {};
    const attendanceByTrainer: Record<string, number> = {};
    let allAttendances: number[] = [];

    for (const fb of feedback) {
      if (fb.attendance_quote && fb.group_id) {
        attendanceByGroup[fb.group_id] = Number(fb.attendance_quote);
      }
      if (fb.attendance_quote && fb.trainer_id) {
        attendanceByTrainer[fb.trainer_id] = Number(fb.attendance_quote);
      }
      if (fb.attendance_quote) {
        allAttendances.push(Number(fb.attendance_quote));
      }
    }

    const overallAttendance =
      allAttendances.length > 0
        ? allAttendances.reduce((a, b) => a + b, 0) / allAttendances.length
        : null;

    // Slot failure rates (from previous seasons' statistics)
    const previousStats = await db
      .select()
      .from(seasonStatistics)
      .where(eq(seasonStatistics.club_id, clubId))
      .orderBy(asc(seasonStatistics.computed_at));

    const slotFailureRates: Record<string, SlotFailureRate> = {};

    for (const stat of previousStats) {
      const rates = stat.slot_failure_rates as Record<string, SlotFailureRate> | null;
      if (rates) {
        for (const [key, val] of Object.entries(rates)) {
          if (!slotFailureRates[key] || val.failureRate > slotFailureRates[key].failureRate) {
            slotFailureRates[key] = val;
          }
        }
      }
    }

    // Wish partner fulfillment
    const wishPartnerRequests = prefs.reduce(
      (sum, p) => sum + ((p.wish_partner_ids as string[]) || []).length,
      0
    );

    // Count fulfilled wish partners
    let wishPartnerFulfilled = 0;
    for (const entry of planEntries) {
      const participants = (entry.expected_participants as string[]) || [];
      const participantPrefs = prefs.filter((p) => participants.includes(p.user_id));
      for (const pref of participantPrefs) {
        const wishIds = (pref.wish_partner_ids as string[]) || [];
        wishPartnerFulfilled += wishIds.filter((wid) => participants.includes(wid)).length;
      }
    }

    const wishPartnerRate =
      wishPartnerRequests > 0 ? (wishPartnerFulfilled / wishPartnerRequests) * 100 : null;

    // Waitlist metrics
    const totalWaitlist = waitlist.length;
    const accepted = waitlist.filter((w) => w.status === 'accepted');
    const waitlistAcceptanceRate =
      totalWaitlist > 0 ? (accepted.length / totalWaitlist) * 100 : null;

    let avgWaitlistDurationDays = 0;
    for (const w of accepted) {
      if (w.registered_at && w.accepted_at) {
        const diff =
          new Date(w.accepted_at).getTime() - new Date(w.registered_at).getTime();
        avgWaitlistDurationDays += diff / (1000 * 60 * 60 * 24);
      }
    }
    avgWaitlistDurationDays = accepted.length > 0 ? avgWaitlistDurationDays / accepted.length : 0;

    // Level upgrades
    const levelUpgradesRecommended = feedback.filter(
      (f) => f.ready_for_next_level === 'yes'
    ).length;

    // Trainer utilization
    const trainerSessions = new Map<string, number>();
    for (const entry of planEntries) {
      const count = trainerSessions.get(entry.trainer_id) || 0;
      trainerSessions.set(entry.trainer_id, count + 1);
    }

    // Conflict metrics
    const totalConflicts = conflicts.length;
    const criticalConflicts = conflicts.filter(
      (c) => c.severity === 'critical'
    ).length;
    const conflictsResolved = conflicts.filter(
      (c) => c.status === 'resolved'
    ).length;

    // Preference metrics
    const preferencesSubmitted = prefs.length;
    const allMembers = await db
      .select()
      .from(userTrainingPreferences)
      .where(eq(userTrainingPreferences.season_id, seasonId));

    const preferencesTotal = allMembers.filter((p) => p.user_role === 'member').length;

    // Build stats record
    const stats: Omit<SeasonStatsType, 'id' | 'created_at'> = {
      season_id: seasonId,
      club_id: clubId,
      total_groups: totalGroups,
      total_members_planned: totalMembersPlanned,
      avg_group_size: String(Math.round(avgGroupSize * 100) / 100),
      groups_below_min_size: groupsBelowMinSize,
      overall_attendance_quote: overallAttendance
        ? String(Math.round(overallAttendance * 100) / 100)
        : null,
      attendance_by_group: attendanceByGroup,
      attendance_by_trainer: attendanceByTrainer,
      slot_failure_rates: slotFailureRates,
      wish_partner_requests: wishPartnerRequests,
      wish_partner_fulfilled: wishPartnerFulfilled,
      wish_partner_fulfillment_rate: wishPartnerRate
        ? String(Math.round(wishPartnerRate * 100) / 100)
        : null,
      total_waitlist_entries: totalWaitlist,
      avg_waitlist_duration_days: String(Math.round(avgWaitlistDurationDays * 100) / 100),
      waitlist_acceptance_rate: waitlistAcceptanceRate
        ? String(Math.round(waitlistAcceptanceRate * 100) / 100)
        : null,
      level_upgrades_recommended: levelUpgradesRecommended,
      level_upgrades_applied: 0, // Will be computed next season
      trainer_utilization_avg: null, // Requires trainer data
      trainer_burnout_warnings: 0,
      total_conflicts_detected: totalConflicts,
      critical_conflicts: criticalConflicts,
      conflicts_resolved: conflictsResolved,
      preferences_submitted: preferencesSubmitted,
      preferences_total: preferencesTotal,
      preference_satisfaction_score: null,
      niveau_span_violations: 0,
      avg_niveau_span_months: null,
      computed_at: new Date(),
    };

    // Upsert into DB
    const [existing] = await db
      .select()
      .from(seasonStatistics)
      .where(eq(seasonStatistics.season_id, seasonId));

    if (existing) {
      await db
        .update(seasonStatistics)
        .set(stats as any)
        .where(eq(seasonStatistics.id, existing.id));
    } else {
      await db.insert(seasonStatistics).values(stats as any);
    }

    return { id: existing?.id || '', ...stats, created_at: new Date() } as SeasonStatsType;
  }

  /**
   * Get cross-season aggregated statistics
   */
  static async getCrossSeasonStats(clubId: string): Promise<CrossSeasonStats> {
    const db = getDb();

    const allStats = await db
      .select()
      .from(seasonStatistics)
      .where(eq(seasonStatistics.club_id, clubId))
      .orderBy(asc(seasonStatistics.computed_at));

    const bySeason: Record<string, SeasonStatsType> = {};
    const mergedSlotRates: Record<string, SlotFailureRate> = {};

    let totalWishFulfilled = 0;
    let totalWishRequests = 0;
    let totalLevelUpgrades = 0;
    let totalMembers = 0;
    let totalWaitlistDuration = 0;
    let waitlistCount = 0;

    for (const stat of allStats) {
      bySeason[stat.season_id] = stat as unknown as SeasonStatsType;

      // Merge slot failure rates
      const rates = stat.slot_failure_rates as Record<string, SlotFailureRate> | null;
      if (rates) {
        for (const [key, val] of Object.entries(rates)) {
          if (!mergedSlotRates[key] || val.failureRate > mergedSlotRates[key].failureRate) {
            mergedSlotRates[key] = val;
          }
        }
      }

      totalWishFulfilled += stat.wish_partner_fulfilled || 0;
      totalWishRequests += stat.wish_partner_requests || 0;
      totalLevelUpgrades += stat.level_upgrades_recommended || 0;
      totalMembers += stat.total_members_planned || 0;

      if (stat.avg_waitlist_duration_days) {
        totalWaitlistDuration += Number(stat.avg_waitlist_duration_days);
        waitlistCount++;
      }
    }

    return {
      bySeason,
      slotFailureRates: mergedSlotRates,
      avgAttendanceByTrainer: {}, // Requires trainer-level aggregation
      avgWaitlistDurationDays: waitlistCount > 0 ? totalWaitlistDuration / waitlistCount : 0,
      overallWishPartnerFulfillmentRate:
        totalWishRequests > 0 ? (totalWishFulfilled / totalWishRequests) * 100 : 0,
      levelUpgradeRate:
        totalMembers > 0 ? (totalLevelUpgrades / totalMembers) * 100 : 0,
    };
  }

  /**
   * Count groups below minimum size threshold
   */
  private static async countGroupsBelowMinSize(
    entries: any[],
    clubId: string,
    seasonId: string
  ): Promise<number> {
    const [config] = await getDb()
      .select()
      .from(seasonPlanningConfigs)
      .where(
        and(
          eq(seasonPlanningConfigs.club_id, clubId),
          eq(seasonPlanningConfigs.season_id, seasonId)
        )
      );

    const minSize = config?.group_min_size || 3;
    let count = 0;

    const groupMembers = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!entry.group_id) continue;
      const members = groupMembers.get(entry.group_id) || new Set();
      for (const m of (entry.expected_participants as string[]) || []) {
        members.add(m);
      }
      groupMembers.set(entry.group_id, members);
    }

    for (const [, members] of groupMembers) {
      if (members.size < minSize) count++;
    }

    return count;
  }
}
