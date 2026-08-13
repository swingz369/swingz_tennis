/**
 * Pure conflict-detection helpers of the season-planning conflict detector.
 *
 * Extracted from `lib/season-planning/conflict-detector.ts` (where the logic
 * lived inline inside the conflict rules) so it can be unit-tested directly.
 * This module intentionally has NO runtime imports — importing it must not pull
 * in the database or Drizzle modules.
 */

import type { GroupAssignment } from '@/lib/season-planning/types';

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

/** Assignments whose warnings contain a "Niveau-Spanne" violation. */
export function detectLargeNiveauSpan(assignments: GroupAssignment[]): GroupAssignment[] {
  return assignments.filter((a) => a.warnings.some((w) => w.includes('Niveau-Spanne')));
}
