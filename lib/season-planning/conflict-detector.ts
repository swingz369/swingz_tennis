// Conflict Detection Engine for KI Saisonplanung
// Implements Schritt 5: automatic conflict detection with 7 conflict types
// Runs continuously in the background, blocks confirmation for critical issues

import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  courts,
  planningConflicts,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq } from 'drizzle-orm';

/**
 * Minimal query-builder interface for the optional transaction parameter.
 * Drizzle's `PgTransaction` and `PostgresJsDatabase` both satisfy this.
 * The signatures are intentionally wide (accepting `any` for the table) so
 * that we can pass in either a transaction instance or the global db handle
 * without Drizzle's exact generic types clashing across call sites.
 */
type DrizzleTransactionLike = {
  delete: (table: any) => { where: (filter: any) => Promise<any> };
  insert: (table: any) => { values: (rows: any | any[]) => Promise<any> };
};
import type {
  ConflictDetectionResult,
  ConflictSeverityLevel,
  ConflictTypeCode,
} from '@/lib/season-planning/types';
import type { GroupAssignment } from '@/lib/season-planning/types';
import { DAY_LABELS } from '@/lib/season-planning/schedule-constants';

/** Convert 1-indexed dayOfWeek (1=Mo..7=So) to German weekday name */
function dayName(dow: number): string {
  return DAY_LABELS[dow - 1] ?? `Tag ${dow}`;
}

// ============================================
// CONFLICT DEFINITIONS
// ============================================

interface ConflictRule {
  type: ConflictTypeCode;
  severity: ConflictSeverityLevel;
  description: string;
  check: (params: ConflictCheckParams) => Promise<ConflictDetectionResult[]>;
}

interface ConflictCheckParams {
  seasonId: string;
  clubId: string;
  assignments: GroupAssignment[];
  existingPlanEntries: Array<{
    id: string;
    trainer_id: string;
    court_id: string | null;
    group_id: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  trainers: Array<{ id: string; name: string; max_hours_per_week: number }>;
  courts: Array<{ id: string; name: string }>;
  slotFailureRates: Record<string, number>;
  config: {
    trainerUtilizationMaxPct: number;
    slotFailureThreshold: number;
    maxNiveauSpanBeginner: number;
    maxNiveauSpanAdvanced: number;
  };
}

// ============================================
// TIME HELPERS
// ============================================

function timeStringToMinutes(time: string): number {
  // Handles both "HH:MM" and "HH:MM:SS"
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeStringToMinutes(start1);
  const e1 = timeStringToMinutes(end1);
  const s2 = timeStringToMinutes(start2);
  const e2 = timeStringToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// ============================================
// CONFLICT RULES
// ============================================

const CONFLICT_RULES: ConflictRule[] = [
  // 1. Trainer double-booking (KRITISCH)
  {
    type: 'trainer_double_booking',
    severity: 'critical',
    description:
      'Trainer-Doppelbelegung: Derselbe Trainer ist zur selben Zeit zwei Gruppen zugewiesen',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const seen = new Map<string, GroupAssignment[]>();

      for (const assignment of params.assignments) {
        const key = `${assignment.trainerId}_${assignment.dayOfWeek}_${assignment.startTime}`;
        const existing = seen.get(key) || [];
        existing.push(assignment);
        seen.set(key, existing);
      }

      // Also check against existing plan entries
      for (const entry of params.existingPlanEntries) {
        for (const assignment of params.assignments) {
          if (
            entry.trainer_id === assignment.trainerId &&
            entry.day_of_week === assignment.dayOfWeek &&
            timeSlotsOverlap(
              entry.start_time,
              entry.end_time,
              assignment.startTime,
              assignment.endTime
            )
          ) {
            const key = `${assignment.trainerId}_${assignment.dayOfWeek}_${entry.start_time}`;
            const existing = seen.get(key) || [];
            existing.push(assignment);
            seen.set(key, existing);
          }
        }
      }

      for (const [, groupAssignments] of seen) {
        if (groupAssignments.length > 1) {
          conflicts.push({
            id: `conflict_tdb_${groupAssignments[0].trainerId}_${groupAssignments[0].dayOfWeek}_${groupAssignments[0].startTime}`,
            type: 'trainer_double_booking',
            severity: 'critical',
            description: `Trainer ${groupAssignments[0].trainerName} ist ${groupAssignments.length}-fach belegt am ${dayName(groupAssignments[0].dayOfWeek)} um ${groupAssignments[0].startTime} (Gruppen: ${groupAssignments.map((g) => g.groupName).join(', ')})`,
            suggestedResolution:
              'Weisen Sie eine der Gruppen einem anderen Trainer oder Zeitslot zu.',
            affectedEntities: {
              trainerIds: [groupAssignments[0].trainerId],
              memberIds: groupAssignments.flatMap((g) => g.memberIds),
              courtIds: groupAssignments.map((g) => g.courtId).filter(Boolean) as string[],
              groupIds: groupAssignments.map((g) => g.groupId),
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: groupAssignments[0].dayOfWeek,
              startTime: groupAssignments[0].startTime,
              endTime: groupAssignments[0].endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 2. Member in two overlapping groups (KRITISCH)
  {
    type: 'member_double_booking',
    severity: 'critical',
    description:
      'Mitglied in zwei Gruppen: Ein Mitglied ist in zwei zeitlich überschneidenden Gruppen eingeteilt',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const memberGroups = new Map<string, GroupAssignment[]>();

      for (const assignment of params.assignments) {
        for (const memberId of assignment.memberIds) {
          const existing = memberGroups.get(memberId) || [];
          existing.push(assignment);
          memberGroups.set(memberId, existing);
        }
      }

      for (const [memberId, groupAssignments] of memberGroups) {
        if (groupAssignments.length <= 1) continue;

        // Check for time overlaps
        for (let i = 0; i < groupAssignments.length; i++) {
          for (let j = i + 1; j < groupAssignments.length; j++) {
            const a = groupAssignments[i];
            const b = groupAssignments[j];
            if (
              a.dayOfWeek === b.dayOfWeek &&
              timeSlotsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
            ) {
              const memberName =
                a.memberDetails.find((d) => d.memberId === memberId)?.memberName || memberId;
              conflicts.push({
                id: `conflict_mdb_${memberId}_${a.dayOfWeek}`,
                type: 'member_double_booking',
                severity: 'critical',
                description: `Mitglied ${memberName} ist in zwei überlappenden Gruppen: ${a.groupName} und ${b.groupName} (${a.startTime}-${a.endTime})`,
                suggestedResolution:
                  'Entfernen Sie das Mitglied aus einer der Gruppen oder verschieben Sie eine Gruppe.',
                affectedEntities: {
                  trainerIds: [a.trainerId, b.trainerId],
                  memberIds: [memberId],
                  courtIds: [a.courtId, b.courtId].filter(Boolean) as string[],
                  groupIds: [a.groupId, b.groupId],
                  planEntryIds: [],
                },
                timeSlot: {
                  dayOfWeek: a.dayOfWeek,
                  startTime: a.startTime,
                  endTime: a.endTime,
                },
                status: 'open',
                resolvedAt: null,
                resolvedBy: null,
                resolutionNotes: null,
              });
            }
          }
        }
      }
      return conflicts;
    },
  },

  // 3. No trainer assigned (KRITISCH)
  {
    type: 'no_trainer_assigned',
    severity: 'critical',
    description: 'Kein Trainer zugewiesen: Eine Gruppe hat einen Zeitslot, aber keinen Trainer',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      for (const assignment of params.assignments) {
        if (!assignment.trainerId || assignment.trainerId === '') {
          conflicts.push({
            id: `conflict_nta_${assignment.groupId}`,
            type: 'no_trainer_assigned',
            severity: 'critical',
            description: `Gruppe ${assignment.groupName} hat keinen Trainer zugewiesen (Zeitslot: ${assignment.startTime}-${assignment.endTime})`,
            suggestedResolution: 'Weisen Sie der Gruppe einen verfügbaren Trainer zu.',
            affectedEntities: {
              trainerIds: [],
              memberIds: assignment.memberIds,
              courtIds: assignment.courtId ? [assignment.courtId] : [],
              groupIds: [assignment.groupId],
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: assignment.dayOfWeek,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 4. Court unavailable (KRITISCH)
  {
    type: 'court_unavailable',
    severity: 'critical',
    description:
      'Anlage nicht verfügbar: Der gebuchte Court ist zum geplanten Zeitslot nicht verfügbar',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const courtDaySlots = new Map<string, GroupAssignment[]>();

      for (const assignment of params.assignments) {
        if (!assignment.courtId) continue;
        const key = `${assignment.courtId}_${assignment.dayOfWeek}_${assignment.startTime}`;
        const existing = courtDaySlots.get(key) || [];
        existing.push(assignment);
        courtDaySlots.set(key, existing);
      }

      // Also check existing plan entries
      for (const entry of params.existingPlanEntries) {
        if (!entry.court_id) continue;
        for (const assignment of params.assignments) {
          if (
            assignment.courtId === entry.court_id &&
            assignment.dayOfWeek === entry.day_of_week &&
            timeSlotsOverlap(
              entry.start_time,
              entry.end_time,
              assignment.startTime,
              assignment.endTime
            )
          ) {
            const key = `${entry.court_id}_${entry.day_of_week}_${entry.start_time}`;
            const existing = courtDaySlots.get(key) || [];
            existing.push(assignment);
            courtDaySlots.set(key, existing);
          }
        }
      }

      for (const [, groupAssignments] of courtDaySlots) {
        if (groupAssignments.length > 1) {
          const courtName = groupAssignments[0].courtName || 'Unbekannt';
          conflicts.push({
            id: `conflict_cu_${groupAssignments[0].courtId}_${groupAssignments[0].dayOfWeek}_${groupAssignments[0].startTime}`,
            type: 'court_unavailable',
            severity: 'critical',
            description: `Court ${courtName} ist ${groupAssignments.length}-fach belegt am ${dayName(groupAssignments[0].dayOfWeek)} um ${groupAssignments[0].startTime}`,
            suggestedResolution:
              'Weisen Sie eine der Gruppen einem anderen Court oder Zeitslot zu.',
            affectedEntities: {
              trainerIds: groupAssignments.map((g) => g.trainerId),
              memberIds: groupAssignments.flatMap((g) => g.memberIds),
              courtIds: [groupAssignments[0].courtId!],
              groupIds: groupAssignments.map((g) => g.groupId),
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: groupAssignments[0].dayOfWeek,
              startTime: groupAssignments[0].startTime,
              endTime: groupAssignments[0].endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 5. Trainer over limit (WARNUNG)
  {
    type: 'trainer_over_limit',
    severity: 'warning',
    description:
      'Trainer über Limit: Ein Trainer überschreitet sein konfiguriertes Wochenstunden-Limit',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const trainerSessions = new Map<string, number>();

      for (const assignment of params.assignments) {
        const count = trainerSessions.get(assignment.trainerId) || 0;
        trainerSessions.set(assignment.trainerId, count + 1);
      }

      for (const trainer of params.trainers) {
        const sessions = trainerSessions.get(trainer.id) || 0;
        const hoursAssigned = sessions * 1.5; // 90-minute sessions
        const maxHours =
          trainer.max_hours_per_week * (params.config.trainerUtilizationMaxPct / 100);

        if (hoursAssigned > maxHours) {
          conflicts.push({
            id: `conflict_tol_${trainer.id}`,
            type: 'trainer_over_limit',
            severity: 'warning',
            description: `Trainer ${trainer.name}: ${sessions} Sessions (${hoursAssigned}h) überschreiten das Limit von ${maxHours}h (${params.config.trainerUtilizationMaxPct}% von ${trainer.max_hours_per_week}h)`,
            suggestedResolution:
              'Reduzieren Sie die Sessions für diesen Trainer oder erhöhen Sie das Limit.',
            affectedEntities: {
              trainerIds: [trainer.id],
              memberIds: params.assignments
                .filter((a) => a.trainerId === trainer.id)
                .flatMap((a) => a.memberIds),
              courtIds: [],
              groupIds: params.assignments
                .filter((a) => a.trainerId === trainer.id)
                .map((a) => a.groupId),
              planEntryIds: [],
            },
            timeSlot: null,
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 6. High failure rate slot (HINWEIS)
  {
    type: 'high_failure_rate_slot',
    severity: 'info',
    description: 'Hohe Ausfallrate: Ein genutzter Zeitslot hat historisch ≥ 30% Ausfallrate',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const threshold = params.config.slotFailureThreshold / 100;

      for (const assignment of params.assignments) {
        const slotKey = `${assignment.dayOfWeek}_${assignment.startTime}`;
        const failureRate = params.slotFailureRates[slotKey];

        if (failureRate !== undefined && failureRate >= threshold) {
          conflicts.push({
            id: `conflict_hfr_${slotKey}`,
            type: 'high_failure_rate_slot',
            severity: 'info',
            description: `Zeitslot ${assignment.startTime} am ${dayName(assignment.dayOfWeek)} hat eine historische Ausfallrate von ${(failureRate * 100).toFixed(0)}% (Schwelle: ${params.config.slotFailureThreshold}%). Betrifft Gruppe ${assignment.groupName}`,
            suggestedResolution:
              'Erwägen Sie einen alternativen Zeitslot. Falls nicht möglich, bestätigen Sie bewusst.',
            affectedEntities: {
              trainerIds: [assignment.trainerId],
              memberIds: assignment.memberIds,
              courtIds: assignment.courtId ? [assignment.courtId] : [],
              groupIds: [assignment.groupId],
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: assignment.dayOfWeek,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 7. Large niveau span (HINWEIS)
  {
    type: 'large_niveau_span',
    severity: 'info',
    description:
      'Große Niveau-Spanne: Die Erfahrungs-Spanne innerhalb einer Gruppe überschreitet das konfigurierte Maximum',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];

      for (const assignment of params.assignments) {
        const warning = assignment.warnings.find((w) => w.includes('Niveau-Spanne'));
        if (warning) {
          conflicts.push({
            id: `conflict_lns_${assignment.groupId}`,
            type: 'large_niveau_span',
            severity: 'info',
            description: warning,
            suggestedResolution:
              'Teilen Sie die Gruppe auf oder passen Sie die Niveau-Spanne-Konfiguration an.',
            affectedEntities: {
              trainerIds: [assignment.trainerId],
              memberIds: assignment.memberIds,
              courtIds: assignment.courtId ? [assignment.courtId] : [],
              groupIds: [assignment.groupId],
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: assignment.dayOfWeek,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },

  // 8. Avoid partner conflict (WARNUNG) — members who don't want to be grouped together
  {
    type: 'avoid_partner_conflict',
    severity: 'warning',
    description:
      'Avoid-Partner-Konflikt: Zwei Mitglieder, die sich gegenseitig ausschließen, sind in derselben Gruppe',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];

      for (const assignment of params.assignments) {
        const warning = assignment.warnings.find((w) => w.includes('Avoid-Konflikten'));
        if (warning) {
          conflicts.push({
            id: `conflict_apc_${assignment.groupId}`,
            type: 'avoid_partner_conflict',
            severity: 'warning',
            description: `Gruppe ${assignment.groupName}: ${warning}`,
            suggestedResolution:
              'Trennen Sie die betroffenen Mitglieder auf verschiedene Gruppen auf oder klären Sie den Konflikt manuell.',
            affectedEntities: {
              trainerIds: [assignment.trainerId],
              memberIds: assignment.memberIds,
              courtIds: assignment.courtId ? [assignment.courtId] : [],
              groupIds: [assignment.groupId],
              planEntryIds: [],
            },
            timeSlot: {
              dayOfWeek: assignment.dayOfWeek,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
            },
            status: 'open',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
          });
        }
      }
      return conflicts;
    },
  },
];

// ============================================
// CONFLICT DETECTOR
// ============================================

export class ConflictDetector {
  private seasonId: string;
  private clubId: string;

  constructor(seasonId: string, clubId: string) {
    this.seasonId = seasonId;
    this.clubId = clubId;
  }

  /**
   * Run all conflict checks against current assignments
   */
  async detectAll(assignments: GroupAssignment[]): Promise<ConflictDetectionResult[]> {
    const params = await this.buildCheckParams(assignments);
    const allConflicts: ConflictDetectionResult[] = [];

    for (const rule of CONFLICT_RULES) {
      try {
        const ruleConflicts = await rule.check(params);
        allConflicts.push(...ruleConflicts);
      } catch (error) {
        console.error(`[ConflictDetector] Rule ${rule.type} failed:`, error);
      }
    }

    return allConflicts;
  }

  /**
   * Get only critical conflicts (block confirmation)
   */
  getCriticalConflicts(conflicts: ConflictDetectionResult[]): ConflictDetectionResult[] {
    return conflicts.filter((c) => c.severity === 'critical');
  }

  /**
   * Check if plan can be confirmed (no critical conflicts)
   */
  canConfirm(conflicts: ConflictDetectionResult[]): boolean {
    return this.getCriticalConflicts(conflicts).length === 0;
  }

  /**
   * Summarize conflicts for display
   */
  summarize(conflicts: ConflictDetectionResult[]): {
    critical: number;
    warnings: number;
    info: number;
    total: number;
  } {
    return {
      critical: conflicts.filter((c) => c.severity === 'critical').length,
      warnings: conflicts.filter((c) => c.severity === 'warning').length,
      info: conflicts.filter((c) => c.severity === 'info').length,
      total: conflicts.length,
    };
  }

  /**
   * Persist detected conflicts to the planning_conflicts table.
   * Deletes existing unresolved conflicts for this season before inserting.
   *
   * @param conflicts - The conflicts to persist
   * @param tx - Optional transaction scoped DB instance (from db.transaction()).
   *   If provided, all queries run within that transaction; otherwise uses the global DB.
   */
  async persistConflicts(
    conflicts: ConflictDetectionResult[],
    // Drizzle's PgTransaction type differs from PostgresJsDatabase, but both
    // satisfy the query-builder interface (select/insert/update/delete).
    // We type as `unknown` and let the minimal query-builder interface below
    // validate the actual usage at the call sites.
    tx?: DrizzleTransactionLike
  ): Promise<number> {
    if (conflicts.length === 0) return 0;

    const dbInstance = tx ?? db;

    // Delete previously detected open conflicts for this season (re-detect on each run)
    await dbInstance
      .delete(planningConflicts)
      .where(
        and(eq(planningConflicts.season_id, this.seasonId), eq(planningConflicts.status, 'open'))
      );

    const rows = conflicts.map((c) => ({
      season_id: this.seasonId,
      club_id: this.clubId,
      conflict_type: c.type,
      severity: c.severity,
      affected_plan_entry_ids: c.affectedEntities?.planEntryIds || [],
      affected_trainer_id: c.affectedEntities?.trainerIds?.[0] || null,
      affected_court_id: c.affectedEntities?.courtIds?.[0] || null,
      affected_user_ids: c.affectedEntities?.memberIds || [],
      affected_group_ids: c.affectedEntities?.groupIds || [],
      conflict_time_slot: c.timeSlot,
      description: c.description,
      suggested_resolution: c.suggestedResolution,
      status: 'open',
      detection_source: 'auto_planner',
    }));

    // Typed insert-cast: Drizzle's `.values()` requires the exact
    // `$inferInsert` shape; we bridge via `unknown` because individual
    // fields may be optional / partial in the input rows. The runtime
    // shape is verified by the DB constraints (see planningConflicts
    // schema in src/infrastructure/persistence/schema.ts).
    await dbInstance
      .insert(planningConflicts)
      .values(rows as unknown as (typeof planningConflicts.$inferInsert)[]);
    return rows.length;
  }

  // ============================================
  // HELPERS
  // ============================================

  private async buildCheckParams(assignments: GroupAssignment[]): Promise<ConflictCheckParams> {
    // Load plan entries for this season (for checking against existing data)
    const entries = await db
      .select()
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, this.seasonId));

    // Load trainers
    const trainerRows = await db.select().from(trainers);

    // Load courts
    const courtRows = await db.select().from(courts).where(eq(courts.club_id, this.clubId));

    // Load slot failure rates from statistics
    const stats = await db
      .select()
      .from(seasonStatistics)
      .where(eq(seasonStatistics.club_id, this.clubId));

    const slotFailureRates: Record<string, number> = {};
    for (const stat of stats) {
      const rates = stat.slot_failure_rates as Record<
        string,
        {
          failure_rate: number;
        }
      > | null;
      if (rates) {
        for (const [key, val] of Object.entries(rates)) {
          if (!slotFailureRates[key] || val.failure_rate > slotFailureRates[key]) {
            slotFailureRates[key] = val.failure_rate;
          }
        }
      }
    }

    // Load config
    const [dbConfig] = await db
      .select()
      .from(seasonPlanningConfigs)
      .where(
        and(
          eq(seasonPlanningConfigs.club_id, this.clubId),
          eq(seasonPlanningConfigs.season_id, this.seasonId)
        )
      );

    return {
      seasonId: this.seasonId,
      clubId: this.clubId,
      assignments,
      existingPlanEntries: entries.map((e) => ({
        id: e.id,
        trainer_id: e.trainer_id,
        court_id: e.court_id,
        group_id: e.group_id,
        day_of_week: e.day_of_week,
        start_time: e.start_time,
        end_time: e.end_time,
      })),
      trainers: trainerRows.map((t) => ({
        id: t.id,
        name: t.name,
        max_hours_per_week: t.max_hours_per_week,
      })),
      courts: courtRows.map((c) => ({ id: c.id, name: c.name })),
      slotFailureRates,
      config: {
        trainerUtilizationMaxPct: dbConfig?.trainer_utilization_max_pct || 80,
        slotFailureThreshold: dbConfig?.slot_failure_rate_threshold_pct || 30,
        maxNiveauSpanBeginner: dbConfig?.max_niveau_span_beginner_months || 4,
        maxNiveauSpanAdvanced: dbConfig?.max_niveau_span_advanced_months || 8,
      },
    };
  }
}
