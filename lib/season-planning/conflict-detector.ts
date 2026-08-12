// Conflict Detection Engine for KI Saisonplanung
// Implements Schritt 5: automatic conflict detection with 7 conflict types
// Runs continuously in the background, blocks confirmation for critical issues

import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  courts,
  planningConflicts,
  users,
  userClubMemberships,
  userTrainingPreferences,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq } from 'drizzle-orm';

import { createLogger } from '@/lib/logger';

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
import type { WeeklyAvailability } from '@/lib/types/season-planning';
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
  members: Array<{ id: string; name: string; availability: WeeklyAvailability | null }>;
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

      for (const assignment of params.assignments) {
        if (assignment.courtId) continue;

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

      const slotMinutes = Math.max(1, params.config.slotDurationMinutes ?? 90);
      const hoursPerSession = slotMinutes / 60;

      for (const trainer of params.trainers) {
        const sessions = trainerSessions.get(trainer.id) || 0;
        const hoursAssigned = sessions * hoursPerSession;
        const maxHours =
          trainer.max_hours_per_week * (params.config.trainerUtilizationMaxPct / 100);

        if (hoursAssigned > maxHours) {
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
    // Load plan entries for this season (for checking against existing data)
    const entries = await db
      .select()
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, this.seasonId));

    // Load trainers
    const trainerRows = await db.select().from(trainers);

    // Load courts
    const courtRows = await db.select().from(courts).where(eq(courts.club_id, this.clubId));

    // Load planungsrelevante Mitglieder samt eingereichter Wochenverfügbarkeit.
    // Left join: wer keine Präferenzen abgegeben hat, muss trotzdem auftauchen —
    // sonst fällt genau diese Gruppe wieder aus der Prüfung heraus.
    const memberRows = await db
      .select({
        id: users.id,
        name: users.full_name,
        availability: userTrainingPreferences.weekly_availability,
        submitted: userTrainingPreferences.is_submitted,
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
      );

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
      members: memberRows.map((m) => ({
        id: m.id,
        name: m.name ?? 'Unbekannt',
        // Nur eingereichte Präferenzen gelten als Aussage über die Verfügbarkeit;
        // ein angefangener Entwurf zählt wie "nichts abgegeben".
        availability: m.submitted ? ((m.availability as WeeklyAvailability | null) ?? null) : null,
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

async function detectConflictsForSeasonInner(seasonId: string, clubId: string) {
  const detector = new ConflictDetector(seasonId, clubId);
  const entries = await db
    .select()
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, seasonId));

  const assignments: GroupAssignment[] = [];
  const groupMap = new Map<string, GroupAssignment>();
  for (const entry of entries) {
    const gid = entry.group_id || entry.id;
    if (groupMap.has(gid)) {
      groupMap.get(gid)!.memberIds.push(...((entry.expected_participants as string[]) || []));
    } else {
      groupMap.set(gid, {
        groupId: gid,
        groupName: gid,
        trainerId: entry.trainer_id,
        trainerName: entry.trainer_id,
        dayOfWeek: entry.day_of_week as any,
        startTime: entry.start_time?.substring(0, 5) || '00:00',
        endTime: entry.end_time?.substring(0, 5) || '00:00',
        courtId: entry.court_id,
        courtName: entry.court_id,
        maxSize: entry.max_participants ?? 6,
        memberIds: (entry.expected_participants as string[]) || [],
        memberDetails: [],
        waitlistIds: [],
        waitlistDetails: [],
        warnings: [],
        conflictIds: [],
      });
    }
  }
  assignments.push(...groupMap.values());

  const conflicts = await detector.detectAll(assignments);
  const summary = detector.summarize(conflicts);
  return { conflicts, summary };
}
