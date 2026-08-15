// Conflict Detection Engine for KI Saisonplanung
// Implements Schritt 5: automatic conflict detection with 7 conflict types
// Runs continuously in the background, blocks confirmation for critical issues

import { createHash } from 'node:crypto';

import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  trainerClubs,
  courts,
  groups,
  planningConflicts,
  users,
  userClubMemberships,
  userTrainingPreferences,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq, inArray } from 'drizzle-orm';

import { createLogger } from '@/lib/logger';

import {
  timeStringToMinutes,
  detectNoCourtAssigned,
  detectTrainerDoubleBookings,
  detectMemberDoubleBookings,
  detectNoTrainerAssignments,
  detectCourtDoubleBookings,
  detectTrainerOverLimit,
  detectLargeNiveauSpan,
  detectAvoidPartnerConflicts,
  type ConflictMemberInfo,
} from './conflict-utils';

const log = createLogger('season-planning:conflict-detector');

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
import type { WeeklyAvailability, SkillLevel } from '@/lib/types/season-planning';
import { DAY_LABELS } from '@/lib/season-planning/schedule-constants';

/** Convert app-wide dayOfWeek (0=Mo..6=So, see lib/types/season-planning.ts) to German weekday name */
function dayName(dow: number): string {
  return DAY_LABELS[dow] ?? `Tag ${dow}`;
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
  /**
   * Alle planungsrelevanten Mitglieder des Vereins mit ihrer eingereichten
   * Wochenverfügbarkeit (null = keine Präferenzen abgegeben). Basis für die
   * Prüfungen "außerhalb der Verfügbarkeit" und "nicht eingeplant".
   */
  members: Array<
    {
      id: string;
      name: string;
      availability: WeeklyAvailability | null;
    } & ConflictMemberInfo
  >;
  slotFailureRates: Record<string, number>;
  config: {
    trainerUtilizationMaxPct: number;
    slotFailureThreshold: number;
    maxNiveauLevelSteps: number;
    /** Slot-Dauer in Minuten (DB: season_planning_configs.slot_duration_minutes,
     *  Default 90). Pflicht für die exakte Trainer-Überlastungs-Berechnung. */
    slotDurationMinutes: number;
  };
}

// ============================================
// TIME HELPERS (pure logic lives in conflict-utils.ts)
// ============================================

/**
 * Lesbare Bezeichnung einer Zuweisung. `groupName` ist nicht überall gefüllt —
 * die Confirm-Route baut die Zuweisungen aus Planeinträgen und setzt dort die
 * Gruppen-UUID ein. Dann beschreibt der Termin die Gruppe besser als ihr "Name".
 */
function assignmentLabel(a: GroupAssignment): string {
  const termin = `${dayName(a.dayOfWeek)} ${a.startTime.substring(0, 5)} Uhr`;
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(a.groupName ?? '');
  return a.groupName && !looksLikeUuid ? `${a.groupName} (${termin})` : `Gruppe ${termin}`;
}

/** dayOfWeek der App (0=Mo..6=So) auf die Tagesschlüssel der Wochenverfügbarkeit. */
const AVAILABILITY_DAY_KEYS: Array<keyof WeeklyAvailability> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Deckt ein angegebenes Verfügbarkeitsfenster den Termin vollständig ab?
 * Ohne abgegebene Präferenzen (`availability == null`) wird nicht gemeckert —
 * dieser Fall gehört zu `member_unplanned`, nicht hierher.
 */
function fitsAvailability(
  availability: WeeklyAvailability | null,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): boolean {
  if (!availability) return true;
  const key = AVAILABILITY_DAY_KEYS[dayOfWeek];
  const slots = key ? availability[key] : undefined;
  if (!slots || slots.length === 0) return false;
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);
  return slots.some(
    (slot) => timeStringToMinutes(slot.start) <= start && end <= timeStringToMinutes(slot.end)
  );
}

/** Nachschlagetabelle für die Niveau- und Avoid-Prüfung. */
function memberInfoMap(members: ConflictCheckParams['members']): Map<string, ConflictMemberInfo> {
  return new Map(
    members.map((m) => [
      m.id,
      { name: m.name, skillLevel: m.skillLevel, avoidMemberIds: m.avoidMemberIds },
    ])
  );
}

// ============================================
// CONFLICT RULES
// ============================================

const CONFLICT_RULES: ConflictRule[] = [
  // 0a. Gruppe ohne Platz (KRITISCH)
  //
  // Die Platzprüfung weiter unten überspringt Zuweisungen ohne `courtId`
  // (`if (!assignment.courtId) continue`) — genau der Fall blieb damit ungeprüft.
  // Er ist teuer: `confirm/route.ts` legt ohne Platz keine Buchungen an, das
  // Training ist für Mitglied und Trainer unsichtbar, die Abrechnung rechnet
  // über `expected_participants` aber trotzdem ab.
  {
    type: 'no_court_assigned',
    severity: 'critical',
    description: 'Gruppe ohne Platz: Der Zuweisung ist kein Platz zugeordnet',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];

      for (const assignment of detectNoCourtAssigned(params.assignments)) {
        conflicts.push({
          id: `conflict_nca_${assignment.groupId}_${assignment.dayOfWeek}_${assignment.startTime}`,
          type: 'no_court_assigned',
          severity: 'critical',
          description: `${assignmentLabel(assignment)} hat keinen Platz — für die ${assignment.memberIds.length} Teilnehmer entstehen beim Veröffentlichen keine Buchungen, die Abrechnung erfasst sie trotzdem.`,
          suggestedResolution:
            'Weisen Sie der Gruppe einen freien Platz zu oder legen Sie sie auf einen Zeitslot, an dem einer frei ist. Zur Winterzeit stehen nur Hallenplätze zur Verfügung.',
          affectedEntities: {
            trainerIds: [assignment.trainerId],
            memberIds: assignment.memberIds,
            courtIds: [],
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
      return conflicts;
    },
  },

  // 0b. Mitglied außerhalb seiner angegebenen Verfügbarkeit (WARNUNG)
  {
    type: 'member_unavailable',
    severity: 'warning',
    description:
      'Mitglied außerhalb der Verfügbarkeit: Der Termin liegt außerhalb der eingereichten Wunschzeiten',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];
      const byId = new Map(params.members.map((m) => [m.id, m]));

      for (const assignment of params.assignments) {
        const offenders = assignment.memberIds
          .map((id) => byId.get(id))
          .filter(
            (m): m is (typeof params.members)[number] =>
              !!m &&
              m.availability !== null &&
              !fitsAvailability(
                m.availability,
                assignment.dayOfWeek,
                assignment.startTime,
                assignment.endTime
              )
          );
        if (offenders.length === 0) continue;

        conflicts.push({
          id: `conflict_mun_${assignment.groupId}_${assignment.dayOfWeek}_${assignment.startTime}`,
          type: 'member_unavailable',
          severity: 'warning',
          description: `${offenders.map((m) => m.name).join(', ')} ${offenders.length === 1 ? 'ist' : 'sind'} in ${assignmentLabel(assignment)} eingeplant, ${offenders.length === 1 ? 'hat' : 'haben'} diese Zeit aber nicht als verfügbar angegeben.`,
          suggestedResolution:
            'Verschieben Sie die Gruppe auf einen passenden Slot oder die betroffenen Mitglieder in eine andere Gruppe. Alternativ Rücksprache halten, ob die Zeit doch passt.',
          affectedEntities: {
            trainerIds: [assignment.trainerId],
            memberIds: offenders.map((m) => m.id),
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
      return conflicts;
    },
  },

  // 0c. Planungsrelevante Mitglieder ohne Gruppe (WARNUNG)
  {
    type: 'member_unplanned',
    severity: 'warning',
    description: 'Mitglied ohne Gruppe: Für die Planung vorgesehen, aber nirgends eingeteilt',
    check: async (params) => {
      const planned = new Set(params.assignments.flatMap((a) => a.memberIds));
      const unplanned = params.members.filter((m) => !planned.has(m.id));
      if (unplanned.length === 0) return [];

      const ohnePraeferenz = unplanned.filter((m) => m.availability === null);
      const grund =
        ohnePraeferenz.length === unplanned.length
          ? ' Alle davon haben keine Präferenzen abgegeben.'
          : ohnePraeferenz.length > 0
            ? ` ${ohnePraeferenz.length} davon haben keine Präferenzen abgegeben.`
            : '';

      return [
        {
          id: `conflict_mup_${params.seasonId}`,
          type: 'member_unplanned',
          severity: 'warning',
          description: `${unplanned.length} für die Planung vorgesehene Mitglieder sind in keiner Gruppe: ${unplanned.map((m) => m.name).join(', ')}.${grund}`,
          suggestedResolution:
            'Mitglieder einer passenden Gruppe zuordnen, auf die Warteliste setzen oder in Schritt 1 aus der Planung nehmen.',
          affectedEntities: {
            trainerIds: [],
            memberIds: unplanned.map((m) => m.id),
            courtIds: [],
            groupIds: [],
            planEntryIds: [],
          },
          timeSlot: null,
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
          resolutionNotes: null,
        },
      ];
    },
  },

  // 1. Trainer double-booking (KRITISCH)
  {
    type: 'trainer_double_booking',
    severity: 'critical',
    description:
      'Trainer-Doppelbelegung: Derselbe Trainer ist zur selben Zeit zwei Gruppen zugewiesen',
    check: async (params) => {
      const conflicts: ConflictDetectionResult[] = [];

      for (const groupAssignments of detectTrainerDoubleBookings(
        params.assignments,
        params.existingPlanEntries
      )) {
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

      for (const { memberId, groupA, groupB } of detectMemberDoubleBookings(params.assignments)) {
        const memberName =
          groupA.memberDetails.find((d) => d.memberId === memberId)?.memberName || memberId;
        conflicts.push({
          id: `conflict_mdb_${memberId}_${groupA.dayOfWeek}`,
          type: 'member_double_booking',
          severity: 'critical',
          description: `Mitglied ${memberName} ist in zwei überlappenden Gruppen: ${groupA.groupName} und ${groupB.groupName} (${groupA.startTime}-${groupA.endTime})`,
          suggestedResolution:
            'Entfernen Sie das Mitglied aus einer der Gruppen oder verschieben Sie eine Gruppe.',
          affectedEntities: {
            trainerIds: [groupA.trainerId, groupB.trainerId],
            memberIds: [memberId],
            courtIds: [groupA.courtId, groupB.courtId].filter(Boolean) as string[],
            groupIds: [groupA.groupId, groupB.groupId],
            planEntryIds: [],
          },
          timeSlot: {
            dayOfWeek: groupA.dayOfWeek,
            startTime: groupA.startTime,
            endTime: groupA.endTime,
          },
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
          resolutionNotes: null,
        });
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
      for (const assignment of detectNoTrainerAssignments(params.assignments)) {
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

      for (const groupAssignments of detectCourtDoubleBookings(
        params.assignments,
        params.existingPlanEntries
      )) {
        const courtName = groupAssignments[0].courtName || 'Unbekannt';
        conflicts.push({
          id: `conflict_cu_${groupAssignments[0].courtId}_${groupAssignments[0].dayOfWeek}_${groupAssignments[0].startTime}`,
          type: 'court_unavailable',
          severity: 'critical',
          description: `Court ${courtName} ist ${groupAssignments.length}-fach belegt am ${dayName(groupAssignments[0].dayOfWeek)} um ${groupAssignments[0].startTime}`,
          suggestedResolution: 'Weisen Sie eine der Gruppen einem anderen Court oder Zeitslot zu.',
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

      for (const {
        trainer,
        sessions,
        hoursAssigned,
        maxHours,
        slotMinutes,
      } of detectTrainerOverLimit(params.assignments, params.trainers, params.config)) {
        conflicts.push({
          id: `conflict_tol_${trainer.id}`,
          type: 'trainer_over_limit',
          severity: 'warning',
          description: `Trainer ${trainer.name}: ${sessions} Sessions (${hoursAssigned.toFixed(2)}h à ${slotMinutes}min) überschreiten das Limit von ${maxHours.toFixed(2)}h (${params.config.trainerUtilizationMaxPct}% von ${trainer.max_hours_per_week}h)`,
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
      const byId = memberInfoMap(params.members);

      for (const { assignment, span, minLabel, maxLabel } of detectLargeNiveauSpan(
        params.assignments,
        byId,
        params.config.maxNiveauLevelSteps
      )) {
        conflicts.push({
          id: `conflict_lns_${assignment.groupId}_${assignment.dayOfWeek}_${assignment.startTime}`,
          type: 'large_niveau_span',
          severity: 'info',
          description: `${assignmentLabel(assignment)}: Niveau-Spanne ${minLabel}–${maxLabel} (${span} Stufen, Maximum ${params.config.maxNiveauLevelSteps})`,
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
      const byId = memberInfoMap(params.members);

      for (const { assignment, pairs, memberIds } of detectAvoidPartnerConflicts(
        params.assignments,
        byId
      )) {
        conflicts.push({
          id: `conflict_apc_${assignment.groupId}_${assignment.dayOfWeek}_${assignment.startTime}`,
          type: 'avoid_partner_conflict',
          severity: 'warning',
          description: `${assignmentLabel(assignment)}: ${pairs.map(([a, b]) => `${a} und ${b}`).join(', ')} möchten laut Präferenzen nicht zusammen trainieren.`,
          suggestedResolution:
            'Trennen Sie die betroffenen Mitglieder auf verschiedene Gruppen auf oder klären Sie den Konflikt manuell.',
          affectedEntities: {
            trainerIds: [assignment.trainerId],
            memberIds,
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
    // Tier-5 (Audit): Defensiv-Dedup. IDs sind per Rule type-prefixed, aber
    // dieselbe logische Stelle kann durch zwei Regeln erfasst werden (Court-
    // und Trainer-Doppelbelegung bei derselben Gruppe). Wir dedupen am Ende
    // nach `id` und behalten die erste Erwähnung, da Regeln mit höherer
    // Priorität (critical) im CONFLICT_RULES-Array zuerst stehen.
    const seenIds = new Set<string>();

    for (const rule of CONFLICT_RULES) {
      try {
        const ruleConflicts = await rule.check(params);
        for (const conflict of ruleConflicts) {
          if (seenIds.has(conflict.id)) {
            continue;
          }
          seenIds.add(conflict.id);
          allConflicts.push(conflict);
        }
      } catch (error) {
        log.error(`[ConflictDetector] Rule ${rule.type} failed:`, error);
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
    // Die sechs Abfragen hängen nicht voneinander ab, liefen aber nacheinander:
    // gegen eine entfernte Datenbank summierten sich die Roundtrips auf über
    // vier Sekunden und rissen zusammen mit `buildAssignmentsFromPlanEntries`
    // das 8-Sekunden-Limit von `detectConflictsForSeason` — die Konfliktseite
    // antwortete dann mit 500. Parallel bleibt die Summe bei der langsamsten
    // Abfrage. (Der Verbindungspool steht auf max: 3, die Abfragen laufen also
    // in zwei Wellen statt sechs.)
    const [entries, trainerRows, courtRows, memberRows, stats, dbConfigRows] = await Promise.all([
      // Plan entries for this season (for checking against existing data)
      db.select().from(seasonPlanEntries).where(eq(seasonPlanEntries.season_id, this.seasonId)),

      // Trainer — über trainer_club auf den Verein eingegrenzt. Vorher lud das
      // `select().from(trainers)` ALLE Trainer aller Vereine; die
      // Auslastungsprüfung lief damit über vereinsfremde Trainer.
      db
        .select({
          id: trainers.id,
          name: trainers.name,
          max_hours_per_week: trainers.max_hours_per_week,
        })
        .from(trainers)
        .innerJoin(trainerClubs, eq(trainerClubs.trainer_id, trainers.id))
        .where(eq(trainerClubs.club_id, this.clubId)),

      db.select().from(courts).where(eq(courts.club_id, this.clubId)),

      // Planungsrelevante Mitglieder samt eingereichter Wochenverfügbarkeit.
      // Left join: wer keine Präferenzen abgegeben hat, muss trotzdem auftauchen —
      // sonst fällt genau diese Gruppe wieder aus der Prüfung heraus.
      db
        .select({
          id: users.id,
          name: users.full_name,
          skill_level: users.skill_level,
          availability: userTrainingPreferences.weekly_availability,
          submitted: userTrainingPreferences.is_submitted,
          avoid_member_ids: userTrainingPreferences.avoid_member_ids,
        })
        .from(userClubMemberships)
        .innerJoin(users, eq(userClubMemberships.user_id, users.id))
        .leftJoin(
          userTrainingPreferences,
          and(
            eq(userTrainingPreferences.user_id, users.id),
            eq(userTrainingPreferences.season_id, this.seasonId),
            eq(userTrainingPreferences.user_role, 'member')
          )
        )
        .where(
          and(
            eq(userClubMemberships.club_id, this.clubId),
            eq(userClubMemberships.role, 'member'),
            eq(userClubMemberships.is_active, true),
            eq(userClubMemberships.include_in_planning, true)
          )
        ),

      // Slot failure rates from statistics
      db.select().from(seasonStatistics).where(eq(seasonStatistics.club_id, this.clubId)),

      db
        .select()
        .from(seasonPlanningConfigs)
        .where(
          and(
            eq(seasonPlanningConfigs.club_id, this.clubId),
            eq(seasonPlanningConfigs.season_id, this.seasonId)
          )
        ),
    ]);

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

    const [dbConfig] = dbConfigRows;

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
      members: memberRows.map((m) => ({
        id: m.id,
        name: m.name ?? 'Unbekannt',
        // Nur eingereichte Präferenzen gelten als Aussage über die Verfügbarkeit;
        // ein angefangener Entwurf zählt wie "nichts abgegeben".
        availability: m.submitted ? ((m.availability as WeeklyAvailability | null) ?? null) : null,
        skillLevel: (m.skill_level ?? 'beginner') as SkillLevel,
        // Ausschlusswünsche gelten auch aus einem Entwurf heraus — anders als bei
        // der Verfügbarkeit ist "will nicht mit X" keine Terminzusage, sondern
        // eine Angabe, die man nicht versehentlich übergeht.
        avoidMemberIds: (m.avoid_member_ids as string[] | null) ?? [],
      })),
      slotFailureRates,
      config: {
        trainerUtilizationMaxPct: dbConfig?.trainer_utilization_max_pct || 80,
        slotFailureThreshold: dbConfig?.slot_failure_rate_threshold_pct || 30,
        maxNiveauLevelSteps:
          (dbConfig as Record<string, unknown>)?.max_niveau_level_steps != null
            ? Number((dbConfig as Record<string, unknown>).max_niveau_level_steps)
            : 1,
        // Tier-2 (Audit): Slot-Dauer MUSS aus der DB-Config kommen, sonst
        // rechnet die Trainer-Überlastungs-Prüfung mit dem falschen Multiplikator.
        // Default 90min spiegelt das Schema-Default in seasonPlanningConfigs.
        slotDurationMinutes: dbConfig?.slot_duration_minutes ?? 90,
      },
    };
  }
}

/**
 * Live conflict detection for a single season — read-only (never calls
 * persistConflicts/writes). Used as the single source of truth for
 * "offene Konflikte" counts/badges, replacing reads against the
 * `planning_conflicts` table, which is only ever populated once at
 * Publish-time and drifts out of sync as the plan changes afterwards.
 */
export async function detectConflictsForSeason(seasonId: string, clubId: string) {
  // ponytail: hard timeout so a stuck Drizzle/Supavisor connection (max:1 pool,
  // seen intermittently on the self-hosted pooler) rejects instead of hanging
  // every page/route that awaits this forever. Callers already catch errors.
  return Promise.race([
    detectConflictsForSeasonInner(seasonId, clubId),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Konfliktprüfung: Datenbank-Timeout')), 8000)
    ),
  ]);
}

/**
 * Live-erkannte Konflikte haben synthetische IDs (`conflict_<typ>_<...>`), die
 * `planning_conflicts.id` (uuid) nicht aufnehmen kann. Wir leiten daraus eine
 * stabile UUID ab, damit ein "gelöst"/"ignoriert" persistiert werden kann,
 * ohne dafür eine Spalte oder Tabelle zusätzlich zu schaffen.
 * ponytail: SHA1-Ableitung statt neuer Schlüsselspalte — bei einer Migration
 * auf ein echtes `conflict_key`-Feld umstellen.
 */
export function conflictRowId(seasonId: string, conflictKey: string): string {
  const h = createHash('sha1').update(`${seasonId}:${conflictKey}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Baut die Zuweisungen für die Konflikterkennung aus den gespeicherten
 * Planeinträgen — die gemeinsame Grundlage von Konfliktseite, Wizard-Schritt 4
 * und der Publish-Route.
 *
 * Zwei Dinge, die vorher fehlten und die Konflikttexte unbrauchbar machten:
 * - Trainer/Platz/Gruppe/Mitglied werden mit ihrem Namen aufgelöst. Vorher stand
 *   in jeder Meldung die UUID ("Trainer 8f2c-… ist 2-fach belegt").
 * - Der Schlüssel enthält Tag und Uhrzeit. Vorher fielen alle Termine einer
 *   Gruppe außer dem ersten aus der Prüfung heraus, weil nur nach `group_id`
 *   zusammengefasst wurde.
 */
export async function buildAssignmentsFromPlanEntries(
  seasonId: string,
  clubId: string
): Promise<GroupAssignment[]> {
  const entries = await db
    .select()
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, seasonId));
  if (entries.length === 0) return [];

  const [trainerRows, courtRows, groupRows] = await Promise.all([
    db
      .select({ id: trainers.id, name: trainers.name })
      .from(trainers)
      .innerJoin(trainerClubs, eq(trainerClubs.trainer_id, trainers.id))
      .where(eq(trainerClubs.club_id, clubId)),
    db.select({ id: courts.id, name: courts.name }).from(courts).where(eq(courts.club_id, clubId)),
    db
      .select({ id: groups.id, name: groups.name, member_ids: groups.member_ids })
      .from(groups)
      .where(eq(groups.club_id, clubId)),
  ]);
  const trainerNames = new Map(trainerRows.map((r) => [r.id, r.name]));
  const courtNames = new Map(courtRows.map((r) => [r.id, r.name]));
  const groupNames = new Map(groupRows.map((r) => [r.id, r.name]));
  const groupMembers = new Map(groupRows.map((r) => [r.id, (r.member_ids as string[]) || []]));

  // `expected_participants` am Planeintrag ist in der Praxis oft leer — die
  // Zugehörigkeit steht dann nur an der Gruppe. Ohne diesen Rückgriff meldete
  // die Prüfung praktisch jedes Mitglied als "ohne Gruppe" und die Regeln zu
  // Mitglieds-Doppelbelegung und Verfügbarkeit liefen ins Leere.
  const participantsOf = (entry: (typeof entries)[number]): string[] => {
    const own = (entry.expected_participants as string[]) || [];
    if (own.length > 0) return own;
    return entry.group_id ? (groupMembers.get(entry.group_id) ?? []) : [];
  };

  const memberIds = [...new Set(entries.flatMap(participantsOf))];
  const memberRows =
    memberIds.length > 0
      ? await db
          .select({ id: users.id, name: users.full_name })
          .from(users)
          .where(inArray(users.id, memberIds))
      : [];
  const memberNames = new Map(memberRows.map((r) => [r.id, r.name ?? 'Unbekannt']));

  const bySlot = new Map<string, GroupAssignment>();
  for (const entry of entries) {
    const gid = entry.group_id || entry.id;
    const startTime = entry.start_time?.substring(0, 5) || '00:00';
    const participants = participantsOf(entry);
    // Eine Gruppe kann mehrfach pro Woche trainieren — jeder Termin ist eine
    // eigene Zuweisung, sonst bleibt der zweite Termin ungeprüft.
    const key = `${gid}_${entry.day_of_week}_${startTime}`;
    const existing = bySlot.get(key);
    if (existing) {
      existing.memberIds.push(...participants);
      existing.memberDetails.push(...participants.map(memberDetail));
      continue;
    }
    bySlot.set(key, {
      groupId: gid,
      groupName: groupNames.get(gid) ?? gid,
      trainerId: entry.trainer_id,
      trainerName: trainerNames.get(entry.trainer_id) ?? 'Unbekannter Trainer',
      dayOfWeek: entry.day_of_week as any,
      startTime,
      endTime: entry.end_time?.substring(0, 5) || '00:00',
      courtId: entry.court_id,
      courtName: entry.court_id ? (courtNames.get(entry.court_id) ?? null) : null,
      maxSize: entry.max_participants ?? 6,
      memberIds: [...participants],
      memberDetails: participants.map(memberDetail),
      waitlistIds: [],
      waitlistDetails: [],
      warnings: [],
      conflictIds: [],
    });
  }
  return [...bySlot.values()];

  function memberDetail(id: string): GroupAssignment['memberDetails'][number] {
    // Nur `memberName` wird von den Konfliktregeln gelesen; der Rest ist
    // Pflichtfeld des Typs und stammt sonst aus dem Clustering.
    return {
      memberId: id,
      memberName: memberNames.get(id) ?? id,
      niveauMatch: 100,
      experienceMonths: 0,
      groupExperienceSpan: '0-0 Monate',
      wishPartnerFulfilled: false,
      wishPartnerNames: [],
      isPromoted: false,
      assignmentReason: '',
    };
  }
}

async function detectConflictsForSeasonInner(seasonId: string, clubId: string) {
  const detector = new ConflictDetector(seasonId, clubId);
  const assignments = await buildAssignmentsFromPlanEntries(seasonId, clubId);

  const conflicts = await detector.detectAll(assignments);

  // Persistierte Entscheidungen (gelöst/ignoriert) auf die live erkannten
  // Konflikte legen — sonst taucht ein ignorierter Konflikt bei jedem Reload
  // wieder als offen auf. Die Zusammenfassung zählt nur noch offene, damit
  // Badges und die Publish-Blockade der Entscheidung folgen.
  const decided = await db
    .select({ id: planningConflicts.id, status: planningConflicts.status })
    .from(planningConflicts)
    .where(eq(planningConflicts.season_id, seasonId));
  const decisionByRowId = new Map(decided.map((row) => [row.id, row.status]));
  for (const conflict of conflicts) {
    const status = decisionByRowId.get(conflictRowId(seasonId, conflict.id));
    // Nur "ignoriert" überlebt eine erneute Erkennung. "Gelöst" behauptet, die
    // Ursache sei beseitigt — steht der Konflikt hier, ist er das nachweislich
    // nicht. Vorher blieb er trotzdem für immer gelöst: bei TC Rheinland waren
    // zwei kritische "kein Platz zugewiesen" als gelöst markiert, die Plätze
    // fehlten weiter, die Publish-Blockade griff nicht — veröffentlicht wurden
    // Sessions ohne Platz, für die keine Buchung entsteht, während die
    // Abrechnung die Teilnehmer trotzdem in Rechnung stellt.
    if (status === 'ignored') conflict.status = status;
  }

  const summary = detector.summarize(conflicts.filter((c) => c.status === 'open'));
  return { conflicts, summary };
}
