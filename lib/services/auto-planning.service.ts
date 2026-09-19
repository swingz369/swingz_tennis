// Auto-Planning Algorithm Service
// Optimizes season planning based on user preferences and constraints
// Supports both deterministic greedy algorithm and AI-powered scheduling (V2)

import type { Json, Tables } from '@/types/supabase';
import type { SeasonClusteringRepository } from '@/infrastructure/persistence/repositories/season-clustering.repository';
import { jsonColumn } from '@/lib/typed-helpers';
import type {
  AutoPlanConfig,
  AlgorithmMetrics,
  WeeklyAvailability,
  DayOfWeek,
} from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('auto-planning');

type CourtRow = Tables<'courts'>;
type GroupRow = Tables<'groups'>;

/**
 * Der Algorithmus benennt Konflikte anders, als es die CHECK-Constraints von `planning_conflicts`
 * erlauben (`conflict_type`, `severity`). Ein ungemappter Wert warf 23514 und riss das Speichern
 * der gesamten Planung mit — die Antwort an die Oberfläche behält die Algorithmus-Namen.
 */
const CONFLICT_TYPE_DB: Record<string, string> = {
  resource_not_available: 'no_trainer_assigned',
  court_double_booking: 'no_court_assigned',
  user_unavailable: 'member_unavailable',
  preference_mismatch: 'member_unplanned',
};
const SEVERITY_DB: Record<string, string> = { high: 'critical', medium: 'warning', low: 'info' };

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
    dryRun: boolean,
    repo: SeasonClusteringRepository
  ): Promise<{
    entries: PlanningSlot[];
    conflicts: Array<{ type: string; description: string; severity: string }>;
    metrics: AlgorithmMetrics;
  }> {
    const startTime = Date.now();

    // 1. Fetch season data
    const season = await repo.findSeason(seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    // 2. Fetch all preferences
    const allPreferences = await repo.submittedPrefsWithNames(seasonId);

    // Fetch all active trainers for the club (including those without submitted prefs)
    // Primary source: trainer_club; Fallback: user_club_memberships with role='trainer'
    let clubTrainers = await repo.activeClubTrainers(season.club_id);
    if (clubTrainers.length === 0) {
      clubTrainers = await repo.activeTrainersByMembership(season.club_id);
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
          // Die Spalte liefert je nach Zeile ein Objekt ODER einen JSON-String —
          // ein blosser Cast machte daraus zur Laufzeit einen String ohne Wochentage.
          weekly_availability:
            jsonColumn<WeeklyAvailability>(pref.weekly_availability) ?? ({} as WeeklyAvailability),
          max_sessions_per_week: pref.max_sessions_per_week || 20,
          can_teach_groups: (pref.can_teach_groups as string[]) || [],
          preferred_court_ids: (pref.preferred_court_ids as string[]) || [],
          priority: pref.priority,
        });
      } else {
        memberPrefs.push({
          user_id: pref.user_id,
          user_name: user_name || 'Unknown',
          weekly_availability:
            jsonColumn<WeeklyAvailability>(pref.weekly_availability) ?? ({} as WeeklyAvailability),
          preferred_level: pref.preferred_level,
          preferred_age_group: pref.preferred_age_group,
          preferred_group_ids: (pref.preferred_group_ids as string[]) || [],
          priority: pref.priority,
        });
      }
    }

    // Add unsubmitted trainers from club trainers table
    for (const trainer of clubTrainers) {
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
    const availableCourts = await repo.activeCourts(season.club_id);

    // 4. Fetch groups
    const availableGroups = await repo.activeGroupRows(season.club_id);

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
      await this.savePlanToDatabase(seasonId, plannedSlots, detectedConflicts, metrics, repo);
    }

    return {
      entries: plannedSlots,
      conflicts: detectedConflicts,
      metrics,
    };
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

    // Days of week (0=Monday, 6=Sunday). Sonntag ist kein Trainingstag (Vereinsrealität)
    // — bewusst ausgeschlossen, nur Mo-Sa.
    const daysOfWeek = [0, 1, 2, 3, 4, 5];
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
    slots: PlanningSlot[],
    conflicts: Array<{ type: string; description: string; severity: string }>,
    metrics: AlgorithmMetrics,
    repo: SeasonClusteringRepository
  ): Promise<void> {
    // HARD CONSTRAINT backstop: kein Trainingsbetrieb am Sonntag (day_of_week=6).
    // Greift sowohl für den deterministischen Algorithmus (oben bereits auf Mo-Sa
    // begrenzt) als auch für generatePlanAI(), deren KI-Pfad keine eigene
    // Wochentags-Begrenzung hat.
    const sundaySlots = slots.filter((s) => s.day_of_week === 6);
    if (sundaySlots.length > 0) {
      log.warn('Filtered out Sunday training slots before save', {
        seasonId,
        count: sundaySlots.length,
      });
      slots = slots.filter((s) => s.day_of_week !== 6);
    }

    // Ersetzen der Planeinträge, Konflikte, Verlauf und Saison-Status in EINER Transaktion
    // (Migration save_season_clustering) — ein Abbruch hinterlässt keine halb geplante Saison.
    //
    // `action_type` unterliegt dem CHECK `season_planning_history_action_type_check`.
    // 'auto_plan_completed' steht dort live NICHT drin — der Insert warf 23514 und riss die
    // komplette Auto-Planung mit (500 pro Aufruf, in jedem Verein). 'plan_created' ist erlaubt,
    // produktiv sonst unbenutzt und trifft die Semantik.
    await repo.saveClustering({
      seasonId,
      groups: [],
      entries: slots.map((slot) => ({
        group_id: slot.group_id,
        trainer_id: slot.trainer_id,
        court_id: slot.court_id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_minutes: slot.duration_minutes,
        entry_type: 'training',
        max_participants: 10,
        expected_participants: slot.expected_participants,
        preference_match_score: Number(slot.preference_match_score.toFixed(2)),
        conflict_score: Number(slot.conflict_score.toFixed(2)),
        optimization_score: Number(
          ((slot.preference_match_score + (100 - slot.conflict_score)) / 2).toFixed(2)
        ),
      })),
      waitlist: [],
      conflicts: conflicts.map((c) => ({
        conflict_type: CONFLICT_TYPE_DB[c.type] ?? 'no_trainer_assigned',
        severity: SEVERITY_DB[c.severity] ?? 'warning',
        description: c.description,
      })),
      history: {
        action_type: 'plan_created',
        details: { entries_created: slots.length, conflicts_detected: conflicts.length },
        entries_affected: slots.length,
        conflicts_created: conflicts.length,
        algorithm_metrics: metrics as unknown as Json,
      },
    });
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
