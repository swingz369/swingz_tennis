import { describe, it, expect } from 'vitest';
import {
  timeSlotsOverlap,
  computeNiveauMatchScore,
  sortMembersByPriority,
} from '@/lib/season-planning/clustering-utils';

// ============================================
// TESTS: computeNiveauMatchScore
// ============================================

describe('computeNiveauMatchScore', () => {
  it('should return 100 when all members have same experience', () => {
    const match = computeNiveauMatchScore(24, [24, 24, 24]);
    expect(match).toBe(100);
  });

  it('should return high match for member close to average', () => {
    // Group: [12, 24, 36], avg=24, span=24
    // Member at 24: distance=0, normalizedDistance=0, match=100
    const match = computeNiveauMatchScore(24, [12, 24, 36]);
    expect(match).toBe(100);
  });

  it('should return lower match for member far from average', () => {
    // Group: [12, 24, 36], avg=24, span=24
    // Member at 12: distance=12, halfSpan=12, normalizedDistance=1, match=0
    const match = computeNiveauMatchScore(12, [12, 24, 36]);
    expect(match).toBe(0);
  });

  it('should handle two-person group', () => {
    // Group: [0, 48], avg=24, span=48
    // Member at 0: distance=24, halfSpan=24, normalizedDistance=1, match=0
    expect(computeNiveauMatchScore(0, [0, 48])).toBe(0);
    // Member at 48: distance=24, halfSpan=24, normalizedDistance=1, match=0
    expect(computeNiveauMatchScore(48, [0, 48])).toBe(0);
    // Member at 24: distance=0, match=100
    expect(computeNiveauMatchScore(24, [0, 48])).toBe(100);
  });

  it('should clamp result between 0 and 100', () => {
    // Extreme outlier
    const match = computeNiveauMatchScore(1000, [0, 1, 2]);
    expect(match).toBeGreaterThanOrEqual(0);
    expect(match).toBeLessThanOrEqual(100);
  });

  it('should handle beginner-level groups (small spans)', () => {
    // Group: [1, 2, 3, 4], avg=2.5, span=3, halfSpan=1.5
    // Member at 3: distance=0.5, normalizedDistance=0.33, match=67
    const match = computeNiveauMatchScore(3, [1, 2, 3, 4]);
    expect(match).toBe(67);
  });

  it('should handle single-member group', () => {
    // Single member: span=0, match=100
    const match = computeNiveauMatchScore(36, [36]);
    expect(match).toBe(100);
  });

  it('should handle empty group without crashing (deterministic 100)', () => {
    // Empty group: avg = 0/0 = NaN, maxSpan = -Infinity → the maxSpan guard is
    // skipped, normalizedDistance falls back to 0 → score = round(100) = 100.
    expect(computeNiveauMatchScore(24, [])).toBe(100);
  });
});

// ============================================
// TESTS: timeSlotsOverlap
// ============================================

describe('timeSlotsOverlap', () => {
  it('should detect overlapping slots', () => {
    expect(timeSlotsOverlap('08:00', '10:00', '09:00', '11:00')).toBe(true);
  });

  it('should not overlap for adjacent slots', () => {
    expect(timeSlotsOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
  });

  it('should not overlap for separated slots', () => {
    expect(timeSlotsOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
  });

  it('should handle identical slots', () => {
    expect(timeSlotsOverlap('14:00', '15:30', '14:00', '15:30')).toBe(true);
  });

  it('should detect partial overlap', () => {
    expect(timeSlotsOverlap('08:00', '10:00', '09:30', '11:00')).toBe(true);
    expect(timeSlotsOverlap('09:30', '11:00', '08:00', '10:00')).toBe(true);
  });
});

// ============================================
// TESTS: Member sorting priority
// ============================================

describe('sortMembersByPriority', () => {
  interface SortableMember {
    id: string;
    name: string;
    experienceMonths: number;
    attendanceQuote: number | null; // null = was waitlisted
  }

  it('should prioritize waitlisted members first', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 90 },
      { id: 'm2', name: 'Bob', experienceMonths: 12, attendanceQuote: null }, // was waitlisted
      { id: 'm3', name: 'Charlie', experienceMonths: 48, attendanceQuote: 85 },
    ];

    const sorted = sortMembersByPriority(members);

    // Bob (waitlisted) should be first
    expect(sorted[0].id).toBe('m2');
  });

  it('should sort by attendance when both have data', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 60 },
      { id: 'm3', name: 'Charlie', experienceMonths: 48, attendanceQuote: 95 },
    ];

    const sorted = sortMembersByPriority(members);

    // Charlie has significantly higher attendance (95 vs 60, diff 35 > 5)
    expect(sorted[0].id).toBe('m3');
  });

  it('should sort by experience when attendance is close', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 80 },
      { id: 'm3', name: 'Charlie', experienceMonths: 48, attendanceQuote: 82 },
    ];

    const sorted = sortMembersByPriority(members);

    // Attendance diff is 2 (not > 5), so sort by experience
    expect(sorted[0].id).toBe('m3'); // More experience
  });

  it('should not mutate the input array', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 90 },
      { id: 'm2', name: 'Bob', experienceMonths: 12, attendanceQuote: null },
    ];

    sortMembersByPriority(members);

    // Waitlisted member still at its original position in the input
    expect(members[0].id).toBe('m1');
  });
});
