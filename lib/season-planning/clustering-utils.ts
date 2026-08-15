/**
 * Pure helpers of the season-clustering engine.
 *
 * Extracted from `lib/season-planning/clustering-engine.ts` (where they lived
 * as private methods / inline logic) so they can be unit-tested directly.
 * This module intentionally has NO runtime imports — importing it must not pull
 * in the database or Supabase modules.
 */

import type { MemberWithDetails, ClusteringMetrics } from '@/lib/season-planning/types';

/**
 * String-comparison overlap for "HH:MM" time slots (back-to-back = no overlap).
 * NOTE: pure lexicographic comparison — do not confuse with the minute-parsing
 * `timeSlotsOverlap` in `lib/season-planning/conflict-utils.ts`.
 */
export function timeSlotsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * 0–100 score for how well a member's experience fits a group's experience
 * spread: 100 when the member sits on the group average, 0 at (or beyond) the
 * half-span from the average, clamped to [0, 100].
 */
export function computeNiveauMatchScore(
  experienceMonths: number,
  groupExperiences: number[]
): number {
  const avg = groupExperiences.reduce((a, b) => a + b, 0) / groupExperiences.length;
  const maxSpan = Math.max(...groupExperiences) - Math.min(...groupExperiences);

  if (maxSpan === 0) return 100;

  const distance = Math.abs(experienceMonths - avg);
  const normalizedDistance = maxSpan > 0 ? distance / (maxSpan / 2) : 0;

  return Math.max(0, Math.min(100, Math.round((1 - normalizedDistance) * 100)));
}

/**
 * Gleichmäßige Gruppengrößen für `total` Mitglieder bei Obergrenze `maxSize`.
 * 7 Mitglieder / max 6 ergeben [4, 3] statt [6, 1] — die frühere Chunk-Logik
 * ließ regelmäßig eine Ein-Personen-Restgruppe übrig.
 */
export function balancedSliceSizes(total: number, maxSize: number): number[] {
  if (total <= 0) return [];
  const groups = Math.ceil(total / Math.max(1, maxSize));
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Eine Zahl für die Gesamtqualität eines Plans, damit die Multi-Start-Varianten
 * in `runClustering` vergleichbar sind. Gewichte nach Vereinsrelevanz: dass
 * jemand überhaupt Training bekommt, schlägt alles andere; Wunschpartner und
 * Niveau-Passung sind Komfort; überlastete Trainer sind teuer.
 */
export function scorePlan(metrics: ClusteringMetrics, unassignedCount: number): number {
  const assigned = Math.max(0, metrics.totalMembers - unassignedCount);
  // Die beiden Komfort-Boni sind Prozentwerte (0–100) und zusammen bewusst auf
  // unter 100 Punkte gedeckelt: ein zusätzlich versorgtes Mitglied (100) muss
  // jede erreichbare Kombination aus Wunschpartner- und Niveau-Bonus schlagen.
  return (
    assigned * 100 +
    metrics.wishPartnerRate * 0.5 +
    metrics.avgNiveauMatch * 0.2 -
    metrics.niveauSpanViolations * 20 -
    metrics.totalWaitlisted * 5 -
    metrics.trainerOverloadWarnings * 30 -
    metrics.highRiskSlotsUsed * 10
  );
}

/**
 * Priority sort for members before grouping:
 * 1. Waitlist-carryovers first (`attendanceQuote === null` means waitlisted),
 * 2. then higher attendance quote (only when the gap is meaningful, > 5 pts),
 * 3. then more experience.
 */
export function sortMembersByPriority<
  T extends Pick<MemberWithDetails, 'attendanceQuote' | 'experienceMonths'>,
>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    // Priorität 1: Wartelisten-Mitglieder aus Vorsaison
    const aWait = a.attendanceQuote === null ? 1 : 0;
    const bWait = b.attendanceQuote === null ? 1 : 0;
    if (aWait !== bWait) return bWait - aWait;

    // Priorität 2: Höhere Anwesenheitsquote
    const aAtt = a.attendanceQuote || 0;
    const bAtt = b.attendanceQuote || 0;
    if (Math.abs(aAtt - bAtt) > 5) return bAtt - aAtt;

    // Priorität 3: Erfahrung (erfahrenere zuerst)
    return b.experienceMonths - a.experienceMonths;
  });
}
