/**
 * Pure conflict-detection helpers of the season-planning conflict detector.
 *
 * Extracted from `lib/season-planning/conflict-detector.ts` (where the logic
 * lived inline inside the conflict rules) so it can be unit-tested directly.
 * This module intentionally has NO runtime imports — importing it must not pull
 * in the database or Drizzle modules.
 */

import type { GroupAssignment } from '@/lib/season-planning/types';
import type { SkillLevel } from '@/lib/types/season-planning';
import { LEVEL_RANK, LEVEL_LABEL } from '@/lib/season-planning/schedule-constants';

// ============================================
// TIME HELPERS
// ============================================

/** Convert "HH:MM" (or "HH:MM:SS") to total minutes since midnight. */
export function timeStringToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Minutes-based overlap test (back-to-back = no overlap); handles "HH:MM"
 * and "HH:MM:SS". NOTE: the clustering engine's `timeSlotsOverlap` in
 * `lib/season-planning/clustering-utils.ts` is a plain string comparison —
 * same name, different semantics.
 */
export function timeSlotsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeStringToMinutes(start1);
  const e1 = timeStringToMinutes(end1);
  const s2 = timeStringToMinutes(start2);
  const e2 = timeStringToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/** Existing plan-entry shape consumed by the double-booking detectors. */
export interface ExistingPlanEntry {
  trainer_id: string;
  court_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// ============================================
// DETECTION LOGIC (grouped findings only — the
// ConflictDetectionResult mapping lives in the rules)
// ============================================

/** Assignments without a court (no place assigned). */
export function detectNoCourtAssigned(assignments: GroupAssignment[]): GroupAssignment[] {
  return assignments.filter((a) => !a.courtId);
}

/**
 * Groups of assignments where the same trainer is double-booked:
 * identical trainer + day + startTime, or overlapping an existing plan entry.
 */
export function detectTrainerDoubleBookings(
  assignments: GroupAssignment[],
  existingPlanEntries: ExistingPlanEntry[] = []
): GroupAssignment[][] {
  const seen = new Map<string, GroupAssignment[]>();

  for (const assignment of assignments) {
    const key = `${assignment.trainerId}_${assignment.dayOfWeek}_${assignment.startTime}`;
    const existing = seen.get(key) || [];
    existing.push(assignment);
    seen.set(key, existing);
  }

  // Also check against existing plan entries
  for (const entry of existingPlanEntries) {
    for (const assignment of assignments) {
      if (
        entry.trainer_id === assignment.trainerId &&
        entry.day_of_week === assignment.dayOfWeek &&
        timeSlotsOverlap(entry.start_time, entry.end_time, assignment.startTime, assignment.endTime)
      ) {
        const key = `${assignment.trainerId}_${assignment.dayOfWeek}_${entry.start_time}`;
        const existing = seen.get(key) || [];
        existing.push(assignment);
        seen.set(key, existing);
      }
    }
  }

  return [...seen.values()].filter((g) => g.length > 1);
}

/**
 * Overlapping same-day group pairs a member is in (member double-booking).
 * Returns one finding per overlapping pair.
 */
export function detectMemberDoubleBookings(
  assignments: GroupAssignment[]
): Array<{ memberId: string; groupA: GroupAssignment; groupB: GroupAssignment }> {
  const findings: Array<{ memberId: string; groupA: GroupAssignment; groupB: GroupAssignment }> =
    [];
  const memberGroups = new Map<string, GroupAssignment[]>();

  for (const assignment of assignments) {
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
          findings.push({ memberId, groupA: a, groupB: b });
        }
      }
    }
  }
  return findings;
}

/** Assignments without a trainer (empty trainerId). */
export function detectNoTrainerAssignments(assignments: GroupAssignment[]): GroupAssignment[] {
  return assignments.filter((a) => !a.trainerId || a.trainerId === '');
}

/**
 * Groups of assignments where the same court is double-booked:
 * identical court + day + startTime, or overlapping an existing plan entry.
 */
export function detectCourtDoubleBookings(
  assignments: GroupAssignment[],
  existingPlanEntries: ExistingPlanEntry[] = []
): GroupAssignment[][] {
  const courtDaySlots = new Map<string, GroupAssignment[]>();

  for (const assignment of assignments) {
    if (!assignment.courtId) continue;
    const key = `${assignment.courtId}_${assignment.dayOfWeek}_${assignment.startTime}`;
    const existing = courtDaySlots.get(key) || [];
    existing.push(assignment);
    courtDaySlots.set(key, existing);
  }

  // Also check existing plan entries
  for (const entry of existingPlanEntries) {
    if (!entry.court_id) continue;
    for (const assignment of assignments) {
      if (
        assignment.courtId === entry.court_id &&
        assignment.dayOfWeek === entry.day_of_week &&
        timeSlotsOverlap(entry.start_time, entry.end_time, assignment.startTime, assignment.endTime)
      ) {
        const key = `${entry.court_id}_${entry.day_of_week}_${entry.start_time}`;
        const existing = courtDaySlots.get(key) || [];
        existing.push(assignment);
        courtDaySlots.set(key, existing);
      }
    }
  }

  return [...courtDaySlots.values()].filter((g) => g.length > 1);
}

export interface TrainerLimitFinding {
  trainer: { id: string; name: string; max_hours_per_week: number };
  sessions: number;
  hoursAssigned: number;
  maxHours: number;
  slotMinutes: number;
}

/**
 * Trainers whose assigned hours exceed `trainerUtilizationMaxPct` of their
 * weekly limit. Hours per session come from `slotDurationMinutes` (never the
 * hardcoded 1.5h).
 */
export function detectTrainerOverLimit(
  assignments: GroupAssignment[],
  trainers: Array<{ id: string; name: string; max_hours_per_week: number }>,
  config: { slotDurationMinutes: number; trainerUtilizationMaxPct: number }
): TrainerLimitFinding[] {
  const trainerSessions = new Map<string, number>();
  for (const assignment of assignments) {
    trainerSessions.set(assignment.trainerId, (trainerSessions.get(assignment.trainerId) || 0) + 1);
  }

  const slotMinutes = Math.max(1, config.slotDurationMinutes ?? 90);
  const hoursPerSession = slotMinutes / 60;
  const findings: TrainerLimitFinding[] = [];

  for (const trainer of trainers) {
    const sessions = trainerSessions.get(trainer.id) || 0;
    const hoursAssigned = sessions * hoursPerSession;
    const maxHours = trainer.max_hours_per_week * (config.trainerUtilizationMaxPct / 100);

    if (hoursAssigned > maxHours) {
      findings.push({ trainer, sessions, hoursAssigned, maxHours, slotMinutes });
    }
  }
  return findings;
}

/**
 * Mitgliedsdaten, die die Niveau- und Avoid-Prüfung braucht. Kommen aus
 * `users.skill_level` und `user_training_preferences.avoid_member_ids`.
 */
export interface ConflictMemberInfo {
  name: string;
  skillLevel: SkillLevel;
  avoidMemberIds: string[];
}

export interface NiveauSpanFinding {
  assignment: GroupAssignment;
  span: number;
  minLabel: string;
  maxLabel: string;
}

/**
 * Gruppen, deren Niveau-Spanne das konfigurierte Maximum überschreitet.
 *
 * Vorher wurde dafür der Warntext der Clustering-Engine durchsucht
 * (`warnings.includes('Niveau-Spanne')`). Planeinträge aus der Datenbank tragen
 * keine Warnungen, deshalb konnte die Regel außerhalb des Dry-Runs nie
 * auslösen. Jetzt wird die Spanne aus den Niveaus der Mitglieder gerechnet.
 */
export function detectLargeNiveauSpan(
  assignments: GroupAssignment[],
  membersById: Map<string, ConflictMemberInfo>,
  maxLevelSteps: number
): NiveauSpanFinding[] {
  const findings: NiveauSpanFinding[] = [];

  for (const assignment of assignments) {
    const ranks = assignment.memberIds
      .map((id) => membersById.get(id))
      .filter((m): m is ConflictMemberInfo => !!m)
      .map((m) => LEVEL_RANK[m.skillLevel] ?? 0);
    if (ranks.length < 2) continue;

    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    const span = max - min;
    if (span <= maxLevelSteps) continue;

    findings.push({
      assignment,
      span,
      minLabel: labelForRank(min),
      maxLabel: labelForRank(max),
    });
  }
  return findings;
}

function labelForRank(rank: number): string {
  const level = (Object.keys(LEVEL_RANK) as SkillLevel[]).find((l) => LEVEL_RANK[l] === rank);
  return level ? LEVEL_LABEL[level] : `Stufe ${rank}`;
}

export interface AvoidPartnerFinding {
  assignment: GroupAssignment;
  /** Paare als Namen, in stabiler Reihenfolge (a vor b nach memberIds-Position). */
  pairs: Array<[string, string]>;
  memberIds: string[];
}

/**
 * Gruppen, in denen zwei Mitglieder stehen, von denen mindestens eines das
 * andere ausgeschlossen hat (`avoid_member_ids`). Auch das lief vorher nur über
 * den Warntext der Engine und damit nie auf gespeicherten Planeinträgen.
 */
export function detectAvoidPartnerConflicts(
  assignments: GroupAssignment[],
  membersById: Map<string, ConflictMemberInfo>
): AvoidPartnerFinding[] {
  const findings: AvoidPartnerFinding[] = [];

  for (const assignment of assignments) {
    const ids = [...new Set(assignment.memberIds)];
    const pairs: Array<[string, string]> = [];
    const involved = new Set<string>();

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = membersById.get(ids[i]);
        const b = membersById.get(ids[j]);
        if (!a || !b) continue;
        if (!a.avoidMemberIds.includes(ids[j]) && !b.avoidMemberIds.includes(ids[i])) continue;
        pairs.push([a.name, b.name]);
        involved.add(ids[i]);
        involved.add(ids[j]);
      }
    }
    if (pairs.length > 0) {
      findings.push({ assignment, pairs, memberIds: [...involved] });
    }
  }
  return findings;
}

// ============================================
// KONFLIKT → BEHEBUNGSORT
// ============================================

/**
 * Wo im Wizard lässt sich die Ursache eines Konflikts beheben?
 *
 * Hintergrund: Die Konfliktliste hatte einen Knopf „Lösen", der nur einen
 * Status schrieb. An den Daten änderte er nichts — der Konflikt galt danach
 * für immer als gelöst, obwohl die Ursache blieb (bei TC Rheinland wurden so
 * zwei Gruppen ohne Platz veröffentlicht). Statt eines Status-Knopfes führt
 * „Beheben" jetzt an die Stelle, an der man die Ursache wirklich abstellt;
 * verschwindet der Konflikt danach von selbst, war er echt behoben.
 */
export function conflictFixTarget(type: string): { step: 1 | 2 | 3; hint: string } {
  switch (type) {
    case 'member_unplanned':
    case 'member_unavailable':
      return {
        step: 1,
        hint: 'Mitglieder-Auswahl: betroffene Mitglieder zuordnen oder aus der Planung nehmen.',
      };
    case 'no_trainer_assigned':
    case 'trainer_double_booking':
    case 'trainer_over_limit':
      return { step: 2, hint: 'Trainer-Verfügbarkeit: Zeiten oder Wochenstunden anpassen.' };
    default:
      // no_court_assigned, court_unavailable, member_double_booking,
      // large_niveau_span, avoid_partner_conflict, high_failure_rate_slot
      return {
        step: 3,
        hint: 'Stundenplan: Platz, Zeit oder Gruppenzusammensetzung des Eintrags ändern.',
      };
  }
}

/**
 * Minderjährig laut Geburtsdatum — `null`, wenn kein Datum hinterlegt ist
 * (dann muss der Aufrufer auf seine bisherige Heuristik zurückfallen).
 */
export function isMinorByBirthdate(dob: unknown, today: Date = new Date()): boolean | null {
  if (!dob) return null;
  const born = dob instanceof Date ? dob : new Date(String(dob));
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age < 18;
}
