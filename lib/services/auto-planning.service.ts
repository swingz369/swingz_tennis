// Auto-Planning Algorithm Service
// Optimizes season planning based on user preferences and constraints
// Supports both deterministic greedy algorithm and AI-powered scheduling (V2)

import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  userTrainingPreferences,
  seasonPlanEntries,
  planningConflicts,
  seasonPlanningHistory,
  courts,
  groups,
  trainers,
  trainerClubs,
  userClubMemberships,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type {
  AutoPlanConfig,
  AlgorithmMetrics,
  WeeklyAvailability,
  DayOfWeek,
} from '@/lib/types/season-planning';
import { aiScheduleServiceV2 } from '@/lib/ai/schedule-generator-v2';
import type { ScheduleGenerationInput } from '@/lib/ai/schedule-generator-v2';
import { createLogger } from '@/lib/logger';

const log = createLogger('auto-planning');

type CourtRow = InferSelectModel<typeof courts>;
type GroupRow = InferSelectModel<typeof groups>;

interface TrainerPreference {
  trainer_id: string;
  trainer_name: string;
  weekly_availability: WeeklyAvailability;
  max_sessions_per_week: number;
  can_teach_groups: string[];
  preferred_court_ids: string[];
  priority: number;
}

interface MemberPreference {
  user_id: string;
  user_name: string;
  weekly_availability: WeeklyAvailability;
  preferred_level: string | null;
  preferred_age_group: string | null;
  preferred_group_ids: string[];
  priority: number;
}

interface PlanningSlot {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  trainer_id: string;
  court_id: string | null;
  group_id: string | null;
  expected_participants: string[];
  preference_match_score: number;
  conflict_score: number;
}

export class AutoPlanningService {
  /**
   * Main auto-planning function
   * Generates optimized schedule based on preferences
   */
  static async generatePlan(
    seasonId: string,
    config: AutoPlanConfig,
    dryRun: boolean = false
  ): Promise<{
    entries: PlanningSlot[];
    conflicts: Array<{ type: string; description: string; severity: string }>;
    metrics: AlgorithmMetrics;
  }> {
    const startTime = Date.now();

    // 1. Fetch season data
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    if (!season) {
      throw new Error('Season not found');
    }

    // 2. Fetch all preferences
    const allPreferences = await db
      .select({
        pref: userTrainingPreferences,
        user_name: sql<string>`COALESCE(users.full_name, users.email)`,
      })
      .from(userTrainingPreferences)
      .leftJoin(sql`users`, sql`users.id = ${userTrainingPreferences.user_id}`)
      .where(
        and(
          eq(userTrainingPreferences.season_id, seasonId),
          eq(userTrainingPreferences.is_submitted, true)
        )
      );

    // Fetch all active trainers for the club (including those without submitted prefs)
    // Primary source: trainer_clubs join
    let clubTrainers = await db
      .select({ trainer: trainers })
      .from(trainers)
      .innerJoin(trainerClubs, eq(trainers.id, trainerClubs.trainer_id))
      .where(and(eq(trainerClubs.club_id, season.club_id), eq(trainers.is_active, true)));

    // Fallback: user_club_memberships with role='trainer'
    if (clubTrainers.length === 0) {
      clubTrainers = await db
        .select({ trainer: trainers })
        .from(userClubMemberships)
        .innerJoin(trainers, eq(userClubMemberships.user_id, trainers.user_id))
        .where(
          and(
            eq(userClubMemberships.club_id, season.club_id),
            eq(userClubMemberships.role, 'trainer'),
            eq(userClubMemberships.is_active, true),
            eq(trainers.is_active, true)
          )
        );
    }

    // Separate trainers and members
    const trainerPrefs: TrainerPreference[] = [];
    const memberPrefs: MemberPreference[] = [];
    const submittedTrainerIds = new Set<string>();

    for (const { pref, user_name } of allPreferences) {
      if (pref.user_role === 'trainer') {
        submittedTrainerIds.add(pref.user_id);
        trainerPrefs.push({
          trainer_id: pref.user_id,
          trainer_name: user_name || 'Unknown',
          weekly_availability: pref.weekly_availability as WeeklyAvailability,
          max_sessions_per_week: pref.max_sessions_per_week || 20,
          can_teach_groups: (pref.can_teach_groups as string[]) || [],
          preferred_court_ids: (pref.preferred_court_ids as string[]) || [],
          priority: pref.priority,
        });
      } else {
        memberPrefs.push({
          user_id: pref.user_id,
          user_name: user_name || 'Unknown',
          weekly_availability: pref.weekly_availability as WeeklyAvailability,
          preferred_level: pref.preferred_level,
          preferred_age_group: pref.preferred_age_group,
          preferred_group_ids: (pref.preferred_group_ids as string[]) || [],
          priority: pref.priority,
        });
      }
    }

    // Add unsubmitted trainers from club trainers table
    for (const { trainer } of clubTrainers) {
      if (trainer.user_id && submittedTrainerIds.has(trainer.user_id)) continue;
      trainerPrefs.push({
        trainer_id: trainer.user_id || trainer.id,
        trainer_name: trainer.name || 'Unknown',
        weekly_availability: {} as WeeklyAvailability,
        max_sessions_per_week: Math.floor(trainer.max_hours_per_week / 1.5),
        can_teach_groups: (trainer.specialties as string[]) || [],
        preferred_court_ids: [],
        priority: 5,
      });
    }

    // 3. Fetch available courts
    const availableCourts = await db
      .select()
      .from(courts)
      .where(and(eq(courts.club_id, season.club_id), eq(courts.is_active, true)));

    // 4. Fetch groups
    const availableGroups = await db
      .select()
      .from(groups)
      .where(and(eq(groups.club_id, season.club_id), eq(groups.is_active, true)));

    // 5. Run optimization algorithm
    const { entries: plannedSlots, conflicts: detectedConflicts } = await this.runOptimization({
      trainerPrefs,
      memberPrefs,
      courts: availableCourts,
      groups: availableGroups,
      config,
    });

    // 6. Calculate metrics
    const endTime = Date.now();
    const metrics: AlgorithmMetrics = {
      iterations: plannedSlots.length, // Simplified - in real impl, track actual iterations
      runtime_ms: endTime - startTime,
      score: this.calculateOverallScore(plannedSlots),
      conflicts_detected: detectedConflicts.length,
      preferences_matched: this.countPreferencesMatched(plannedSlots, memberPrefs),
      trainer_utilization: this.calculateTrainerUtilization(plannedSlots, trainerPrefs),
      court_utilization: this.calculateCourtUtilization(plannedSlots, availableCourts),
    };

    // 7. Save to database if not dry run
    if (!dryRun) {
      await this.savePlanToDatabase(
        seasonId,
        season.club_id,
        plannedSlots,
        detectedConflicts,
        metrics
      );
    }

    return {
      entries: plannedSlots,
      conflicts: detectedConflicts,
      metrics,
    };
  }

  /**
   * AI-powered auto-planning function (V2)
   * Uses Anthropic Claude / OpenAI to generate optimized schedules
   * Falls back to deterministic algorithm if AI is unavailable
   */
  static async generatePlanAI(
    seasonId: string,
    config: AutoPlanConfig,
    dryRun: boolean = false
  ): Promise<{
    entries: PlanningSlot[];
    conflicts: Array<{ type: string; description: string; severity: string }>;
    metrics: AlgorithmMetrics;
    aiEnhanced: boolean;
    modelUsed: string;
  }> {
    const startTime = Date.now();

    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    if (!season) throw new Error('Season not found');

    const allPreferences = await db
      .select({
        pref: userTrainingPreferences,
        user_name: sql<string>`COALESCE(users.full_name, users.email)`,
      })
      .from(userTrainingPreferences)
      .leftJoin(sql`users`, sql`users.id = ${userTrainingPreferences.user_id}`)
      .where(
        and(
          eq(userTrainingPreferences.season_id, seasonId),
          eq(userTrainingPreferences.is_submitted, true)
        )
      );

    const availableCourts = await db
      .select()
      .from(courts)
      .where(and(eq(courts.club_id, season.club_id), eq(courts.is_active, true)));

    if (!aiScheduleServiceV2.isAvailable()) {
      log.info('AI not available, using deterministic algorithm');
      const result = await this.generatePlan(seasonId, config, dryRun);
      return { ...result, aiEnhanced: false, modelUsed: 'none' };
    }

    // Fetch all active trainers for the club (including those without submitted prefs)
    // Primary source: trainer_clubs join
    let clubTrainers = await db
      .select({ trainer: trainers })
      .from(trainers)
      .innerJoin(trainerClubs, eq(trainers.id, trainerClubs.trainer_id))
      .where(and(eq(trainerClubs.club_id, season.club_id), eq(trainers.is_active, true)));

    // Fallback: user_club_memberships with role='trainer'
    if (clubTrainers.length === 0) {
      clubTrainers = await db
        .select({ trainer: trainers })
        .from(userClubMemberships)
        .innerJoin(trainers, eq(userClubMemberships.user_id, trainers.user_id))
        .where(
          and(
            eq(userClubMemberships.club_id, season.club_id),
            eq(userClubMemberships.role, 'trainer'),
            eq(userClubMemberships.is_active, true),
            eq(trainers.is_active, true)
          )
        );
    }

    const submittedTrainerIds = new Set<string>();
    const aiTrainers = allPreferences
      .filter(({ pref }) => pref.user_role === 'trainer')
      .map(({ pref, user_name }) => {
        submittedTrainerIds.add(pref.user_id);
        return {
          id: pref.user_id,
          name: user_name || 'Unknown',
          specialization: pref.can_teach_groups?.[0] || 'general',
          availability: this.flattenAvailability(pref.weekly_availability as WeeklyAvailability),
        };
      });

    // Add unsubmitted trainers from club trainers table
    for (const { trainer } of clubTrainers) {
      if (trainer.user_id && submittedTrainerIds.has(trainer.user_id)) continue;
      aiTrainers.push({
        id: trainer.user_id || trainer.id,
        name: trainer.name || 'Unknown',
        specialization: trainer.specialties?.[0] || 'general',
        availability: [],
      });
    }

    const planningData = {
      members: allPreferences
        .filter(({ pref }) => pref.user_role !== 'trainer')
        .map(({ pref, user_name }) => ({
          id: pref.user_id,
          name: user_name || 'Unknown',
          skillLevel: pref.preferred_level || 'intermediate',
          availability: this.flattenAvailability(pref.weekly_availability as WeeklyAvailability),
        })),
      trainers: aiTrainers,
      courts: availableCourts.map((c) => ({
        id: c.id,
        name: c.name || `Court ${c.id.slice(0, 8)}`,
        capacity: 12, // Courts table has no capacity column; use default
      })),
    };

    const aiInput: ScheduleGenerationInput = {
      clubId: season.club_id,
      startDate: season.start_date || new Date(),
      endDate: season.end_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      constraints: {
        maxParticipantsPerSession: config.maxParticipantsPerSession || 12,
        preferredDays: config.preferredDays,
        preferredTimeSlots: config.preferredTimeSlots
          ?.map((s) => ({
            start: s.start || s.start_time || '',
            end: s.end || s.end_time || '',
          }))
          .filter((s) => s.start && s.end),
        skillLevels: config.skillLevels,
        avoidTrainerOverload: config.avoidTrainerOverload !== false,
        balanceGroupSizes: config.balanceGroupSizes !== false,
      },
    };

    const aiResult = await aiScheduleServiceV2.generateSchedule(aiInput, planningData);

    if (!aiResult.success) {
      log.warn('AI generation failed, using fallback', { reasoning: aiResult.reasoning });
      const result = await this.generatePlan(seasonId, config, dryRun);
      return {
        ...result,
        aiEnhanced: false,
        modelUsed: 'none',
        conflicts: [
          ...result.conflicts,
          {
            type: 'ai_failed',
            description: `AI scheduling failed: ${aiResult.reasoning}. Used fallback.`,
            severity: 'low',
          },
        ],
      };
    }

    const dayOfWeekMap: Record<number, DayOfWeek> = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
    const plannedSlots: PlanningSlot[] = aiResult.sessions.map((s) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      const startH = pad(s.startTime.getHours());
      const startM = pad(s.startTime.getMinutes());
      const startS = pad(s.startTime.getSeconds());
      const endH = pad(s.endTime.getHours());
      const endM = pad(s.endTime.getMinutes());
      const endS = pad(s.endTime.getSeconds());

      return {
        day_of_week: dayOfWeekMap[s.startTime.getDay()] || 0,
        start_time: `${startH}:${startM}:${startS}`,
        end_time: `${endH}:${endM}:${endS}`,
        duration_minutes: Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000),
        trainer_id: s.trainerId,
        court_id: s.courtId,
        group_id: null,
        expected_participants: s.participants,
        preference_match_score: s.confidence * 100,
        conflict_score: 0,
      };
    });

    const endTime = Date.now();
    const sessionCount = aiResult.sessions.length;
    const metrics: AlgorithmMetrics = {
      iterations: sessionCount,
      runtime_ms: endTime - startTime,
      score:
        sessionCount > 0
          ? aiResult.sessions.reduce((sum, s) => sum + s.confidence * 100, 0) / sessionCount
          : 0,
      conflicts_detected: (aiResult.warnings || []).length,
      preferences_matched: aiResult.sessions.reduce((sum, s) => sum + s.participants.length, 0),
      trainer_utilization: this.calculateTrainerUtilization(plannedSlots, []),
      court_utilization: this.calculateCourtUtilization(plannedSlots, availableCourts),
    };

    const conflicts: Array<{ type: string; description: string; severity: string }> = (
      aiResult.warnings || []
    ).map((w) => ({
      type: 'ai_warning',
      description: w,
      severity: 'low' as const,
    }));

    if (!dryRun) {
      await this.savePlanToDatabase(seasonId, season.club_id, plannedSlots, conflicts, metrics);
    }

    return {
      entries: plannedSlots,
      conflicts,
      metrics,
      aiEnhanced: true,
      modelUsed: aiResult.modelUsed,
    };
  }

  /**
   * Flatten WeeklyAvailability to day-name strings for AI input
   */
  private static flattenAvailability(availability: WeeklyAvailability): string[] {
    if (!availability) return [];
    const dayNames = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const;
    return dayNames.filter((day) => {
      const slots = availability[day];
      return slots && Array.isArray(slots) && slots.length > 0;
    });
  }

  /**
   * Core optimization algorithm
   * Uses greedy algorithm with backtracking for conflicts
   */
  private static async runOptimization(params: {
    trainerPrefs: TrainerPreference[];
    memberPrefs: MemberPreference[];
    courts: CourtRow[];
    groups: GroupRow[];
    config: AutoPlanConfig;
  }): Promise<{
    entries: PlanningSlot[];
    conflicts: Array<{ type: string; description: string; severity: string }>;
  }> {
    const { trainerPrefs, memberPrefs, courts, groups } = params;
    const plannedSlots: PlanningSlot[] = [];
    const conflicts: Array<{ type: string; description: string; severity: string }> = [];

    // Standard training session times (configurable)
    const sessionSlots: Array<{ start: string; end: string; duration: number }> = [
      { start: '08:00:00', end: '09:30:00', duration: 90 },
      { start: '09:30:00', end: '11:00:00', duration: 90 },
      { start: '11:00:00', end: '12:30:00', duration: 90 },
      { start: '14:00:00', end: '15:30:00', duration: 90 },
      { start: '15:30:00', end: '17:00:00', duration: 90 },
      { start: '17:00:00', end: '18:30:00', duration: 90 },
      { start: '18:30:00', end: '20:00:00', duration: 90 },
    ];

    // Days of week (0=Monday, 6=Sunday)
    const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Track trainer sessions per week
    const trainerSessionCounts = new Map<string, number>();
    trainerPrefs.forEach((t) => trainerSessionCounts.set(t.trainer_id, 0));

    // Track court usage
    const courtUsage = new Map<string, Set<string>>(); // court_id -> Set of "day_time" keys

    // Iterate through each group
    for (const group of groups) {
      // Find members interested in this group
      const interestedMembers = memberPrefs.filter(
        (m) =>
          m.preferred_group_ids.includes(group.id) ||
          m.preferred_level === group.level ||
          m.preferred_age_group === group.age_group
      );

      if (interestedMembers.length === 0) continue;

      // Find trainers who can teach this group
      const eligibleTrainers = trainerPrefs.filter(
        (t) => t.can_teach_groups.length === 0 || t.can_teach_groups.includes(group.id)
      );

      if (eligibleTrainers.length === 0) {
        conflicts.push({
          type: 'resource_not_available',
          description: `No trainers available for group: ${group.name}`,
          severity: 'high',
        });
        continue;
      }

      // Try to schedule sessions for this group (aim for 2-3 per week)
      const targetSessionsPerWeek = 2;
      let sessionsScheduled = 0;

      for (const dayIndex of daysOfWeek) {
        if (sessionsScheduled >= targetSessionsPerWeek) break;

        const dayName = dayNames[dayIndex] as keyof WeeklyAvailability;

        for (const timeSlot of sessionSlots) {
          if (sessionsScheduled >= targetSessionsPerWeek) break;

          // Find best trainer for this slot
          let bestTrainer: TrainerPreference | null = null;
          let bestScore = -1;

          for (const trainer of eligibleTrainers) {
            // Check trainer availability
            const availability = trainer.weekly_availability[dayName] || [];
            const isAvailable = availability.some(
              (slot) =>
                slot.start <= timeSlot.start.slice(0, 5) && slot.end >= timeSlot.end.slice(0, 5)
            );

            if (!isAvailable) continue;

            // Check session limit
            const currentSessions = trainerSessionCounts.get(trainer.trainer_id) || 0;
            if (currentSessions >= trainer.max_sessions_per_week) continue;

            // Calculate score
            const score =
              trainer.priority * 10 +
              (trainer.max_sessions_per_week - currentSessions) * 5 +
              (trainer.can_teach_groups.includes(group.id) ? 20 : 0);

            if (score > bestScore) {
              bestScore = score;
              bestTrainer = trainer;
            }
          }

          if (!bestTrainer) continue;

          // Find available court
          let selectedCourt: CourtRow | null = null;
          const preferredCourts = courts.filter(
            (c) =>
              bestTrainer!.preferred_court_ids.length === 0 ||
              bestTrainer!.preferred_court_ids.includes(c.id)
          );

          for (const court of preferredCourts.length > 0 ? preferredCourts : courts) {
            const courtKey = `${dayIndex}_${timeSlot.start}`;
            const usage = courtUsage.get(court.id) || new Set();

            if (!usage.has(courtKey)) {
              selectedCourt = court;
              usage.add(courtKey);
              courtUsage.set(court.id, usage);
              break;
            }
          }

          if (!selectedCourt) {
            conflicts.push({
              type: 'court_double_booking',
              description: `No court available for ${group.name} on ${dayName} at ${timeSlot.start}`,
              severity: 'medium',
            });
            continue;
          }

          // Check member availability
          const availableMembers = interestedMembers.filter((member) => {
            const availability = member.weekly_availability[dayName] || [];
            return availability.some(
              (slot) =>
                slot.start <= timeSlot.start.slice(0, 5) && slot.end >= timeSlot.end.slice(0, 5)
            );
          });

          if (availableMembers.length === 0) {
            conflicts.push({
              type: 'user_unavailable',
              description: `No members available for ${group.name} on ${dayName} at ${timeSlot.start}`,
              severity: 'low',
            });
            continue;
          }

          // Calculate preference match score
          const preferenceScore = (availableMembers.length / interestedMembers.length) * 100;

          // Create plan entry
          plannedSlots.push({
            day_of_week: dayIndex as DayOfWeek,
            start_time: timeSlot.start,
            end_time: timeSlot.end,
            duration_minutes: timeSlot.duration,
            trainer_id: bestTrainer.trainer_id,
            court_id: selectedCourt.id,
            group_id: group.id,
            expected_participants: availableMembers.slice(0, 10).map((m) => m.user_id), // Max 10
            preference_match_score: preferenceScore,
            conflict_score: 0, // No conflicts if we got here
          });

          // Update counters
          const currentCount = trainerSessionCounts.get(bestTrainer.trainer_id) || 0;
          trainerSessionCounts.set(bestTrainer.trainer_id, currentCount + 1);
          sessionsScheduled++;
        }
      }

      if (sessionsScheduled < targetSessionsPerWeek) {
        conflicts.push({
          type: 'preference_mismatch',
          description: `Could only schedule ${sessionsScheduled}/${targetSessionsPerWeek} sessions for ${group.name}`,
          severity: 'medium',
        });
      }
    }

    return { entries: plannedSlots, conflicts };
  }

  /**
   * Save generated plan to database
   */
  private static async savePlanToDatabase(
    seasonId: string,
    clubId: string,
    slots: PlanningSlot[],
    conflicts: Array<{ type: string; description: string; severity: string }>,
    metrics: AlgorithmMetrics
  ): Promise<void> {
    // Delete existing plan entries (if re-planning)
    await db.delete(seasonPlanEntries).where(eq(seasonPlanEntries.season_id, seasonId));

    // Insert new plan entries
    if (slots.length > 0) {
      await db.insert(seasonPlanEntries).values(
        slots.map((slot) => ({
          season_id: seasonId,
          club_id: clubId,
          trainer_id: slot.trainer_id,
          court_id: slot.court_id,
          group_id: slot.group_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes,
          starts_from_week: 1,
          ends_at_week: null,
          entry_type: 'training',
          planning_source: 'auto',
          max_participants: 10,
          expected_participants: slot.expected_participants,
          preference_match_score: slot.preference_match_score.toFixed(2),
          conflict_score: slot.conflict_score.toFixed(2),
          optimization_score: (
            (slot.preference_match_score + (100 - slot.conflict_score)) /
            2
          ).toFixed(2),
          status: 'planned',
          notes: null,
          admin_notes: null,
        }))
      );
    }

    // Save conflicts
    if (conflicts.length > 0) {
      await db.insert(planningConflicts).values(
        conflicts.map((conflict) => ({
          season_id: seasonId,
          club_id: clubId,
          conflict_type: conflict.type,
          severity: conflict.severity,
          affected_plan_entry_ids: [],
          description: conflict.description,
          status: 'open',
          detected_at: new Date(),
          detection_source: 'auto_planner',
        }))
      );
    }

    // Log to history
    await db.insert(seasonPlanningHistory).values({
      season_id: seasonId,
      club_id: clubId,
      action_type: 'auto_plan_completed',
      details: {
        entries_created: slots.length,
        conflicts_detected: conflicts.length,
      },
      entries_affected: slots.length,
      conflicts_created: conflicts.length,
      algorithm_metrics: metrics as unknown as Record<string, unknown>,
    });

    // Update season status
    await db
      .update(seasons)
      .set({
        planning_status: 'manual_review',
        last_planned_at: new Date(),
      })
      .where(eq(seasons.id, seasonId));
  }

  // Helper methods
  private static calculateOverallScore(slots: PlanningSlot[]): number {
    if (slots.length === 0) return 0;
    const avgPreferenceScore =
      slots.reduce((sum, s) => sum + s.preference_match_score, 0) / slots.length;
    const avgConflictScore = slots.reduce((sum, s) => sum + s.conflict_score, 0) / slots.length;
    return (avgPreferenceScore + (100 - avgConflictScore)) / 2;
  }

  private static countPreferencesMatched(
    slots: PlanningSlot[],
    _members: MemberPreference[]
  ): number {
    const matchedUsers = new Set<string>();
    slots.forEach((slot) => slot.expected_participants.forEach((uid) => matchedUsers.add(uid)));
    return matchedUsers.size;
  }

  private static calculateTrainerUtilization(
    slots: PlanningSlot[],
    trainers: TrainerPreference[]
  ): number {
    if (trainers.length === 0) return 0;
    const trainerSessions = new Map<string, number>();
    slots.forEach((slot) => {
      const count = trainerSessions.get(slot.trainer_id) || 0;
      trainerSessions.set(slot.trainer_id, count + 1);
    });

    const totalUtilization = Array.from(trainerSessions.entries()).reduce((sum, [tid, count]) => {
      const trainer = trainers.find((t) => t.trainer_id === tid);
      const maxSessions = trainer?.max_sessions_per_week || 20;
      return sum + (count / maxSessions) * 100;
    }, 0);

    return totalUtilization / trainers.length;
  }

  private static calculateCourtUtilization(slots: PlanningSlot[], courts: CourtRow[]): number {
    if (courts.length === 0) return 0;
    const totalSlotsPerWeek = 7 * 10; // 7 days * ~10 slots per day
    const usedSlots = slots.length;
    const maxPossible = courts.length * totalSlotsPerWeek;
    return (usedSlots / maxPossible) * 100;
  }
}
