/**
 * Pure helpers of the season-clustering engine.
 *
 * Extracted from `lib/season-planning/clustering-engine.ts` (where they lived
 * as private methods / inline logic) so they can be unit-tested directly.
 * This module intentionally has NO runtime imports — importing it must not pull
 * in the database or Supabase modules.
 */

import type { MemberWithDetails } from '@/lib/season-planning/types';

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
