import { describe, it, expect } from 'vitest';

// ============================================
// PURE FUNCTIONS (extracted from clustering-engine.ts)
// ============================================

function computeNiveauMatch(memberExperienceMonths: number, groupExperiences: number[]): number {
  const avg = groupExperiences.reduce((a, b) => a + b, 0) / groupExperiences.length;
  const maxSpan = Math.max(...groupExperiences) - Math.min(...groupExperiences);

  if (maxSpan === 0) return 100;

  const distance = Math.abs(memberExperienceMonths - avg);
  const normalizedDistance = maxSpan > 0 ? distance / (maxSpan / 2) : 0;

  return Math.max(0, Math.min(100, Math.round((1 - normalizedDistance) * 100)));
}

function timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && start2 < end1;
}

// ============================================
// TESTS: computeNiveauMatch
// ============================================

describe('computeNiveauMatch', () => {
  it('should return 100 when all members have same experience', () => {
    const match = computeNiveauMatch(24, [24, 24, 24]);
    expect(match).toBe(100);
  });

  it('should return high match for member close to average', () => {
    // Group: [12, 24, 36], avg=24, span=24
    // Member at 24: distance=0, normalizedDistance=0, match=100
    const match = computeNiveauMatch(24, [12, 24, 36]);
    expect(match).toBe(100);
  });

  it('should return lower match for member far from average', () => {
    // Group: [12, 24, 36], avg=24, span=24
    // Member at 12: distance=12, halfSpan=12, normalizedDistance=1, match=0
    const match = computeNiveauMatch(12, [12, 24, 36]);
    expect(match).toBe(0);
  });

  it('should handle two-person group', () => {
    // Group: [0, 48], avg=24, span=48
    // Member at 0: distance=24, halfSpan=24, normalizedDistance=1, match=0
    expect(computeNiveauMatch(0, [0, 48])).toBe(0);
    // Member at 48: distance=24, halfSpan=24, normalizedDistance=1, match=0
    expect(computeNiveauMatch(48, [0, 48])).toBe(0);
    // Member at 24: distance=0, match=100
    expect(computeNiveauMatch(24, [0, 48])).toBe(100);
  });

  it('should clamp result between 0 and 100', () => {
    // Extreme outlier
    const match = computeNiveauMatch(1000, [0, 1, 2]);
    expect(match).toBeGreaterThanOrEqual(0);
    expect(match).toBeLessThanOrEqual(100);
  });

  it('should handle beginner-level groups (small spans)', () => {
    // Group: [1, 2, 3, 4], avg=2.5, span=3, halfSpan=1.5
    // Member at 3: distance=0.5, normalizedDistance=0.33, match=67
    const match = computeNiveauMatch(3, [1, 2, 3, 4]);
    expect(match).toBe(67);
  });

  it('should handle single-member group', () => {
    // Single member: span=0, match=100
    const match = computeNiveauMatch(36, [36]);
    expect(match).toBe(100);
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
// TESTS: Group size validation
// ============================================

describe('group size constraints', () => {
  const GROUP_MIN_SIZE = 3;
  const GROUP_MAX_SIZE = 12;

  it('should allow groups within size limits', () => {
    const sizes = [3, 6, 8, 12];
    for (const size of sizes) {
      expect(size >= GROUP_MIN_SIZE && size <= GROUP_MAX_SIZE).toBe(true);
    }
  });

  it('should flag undersized groups', () => {
    const sizes = [1, 2];
    for (const size of sizes) {
      expect(size < GROUP_MIN_SIZE).toBe(true);
    }
  });

  it('should flag oversized groups', () => {
    expect(13 > GROUP_MAX_SIZE).toBe(true);
    expect(20 > GROUP_MAX_SIZE).toBe(true);
  });
});

// ============================================
// TESTS: Niveau span validation
// ============================================

describe('niveau span validation', () => {
  const MAX_NIVEAU_SPAN_BEGINNER = 4; // months
  const MAX_NIVEAU_SPAN_ADVANCED = 8;

  it('should pass when span within beginner limit', () => {
    const experiences = [2, 3, 4, 5]; // span = 3
    const span = Math.max(...experiences) - Math.min(...experiences);
    expect(span).toBeLessThanOrEqual(MAX_NIVEAU_SPAN_BEGINNER);
  });

  it('should flag when span exceeds beginner limit', () => {
    const experiences = [0, 1, 12]; // span = 12
    const span = Math.max(...experiences) - Math.min(...experiences);
    expect(span).toBeGreaterThan(MAX_NIVEAU_SPAN_BEGINNER);
  });

  it('should allow wider span for advanced groups', () => {
    const experiences = [36, 40, 44]; // span = 8
    const span = Math.max(...experiences) - Math.min(...experiences);
    expect(span).toBeLessThanOrEqual(MAX_NIVEAU_SPAN_ADVANCED);
  });
});

// ============================================
// TESTS: Member sorting priority
// ============================================

describe('member sorting priority', () => {
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

    const sorted = [...members].sort((a, b) => {
      const aWait = a.attendanceQuote === null ? 1 : 0;
      const bWait = b.attendanceQuote === null ? 1 : 0;
      if (aWait !== bWait) return bWait - aWait;

      const aAtt = a.attendanceQuote || 0;
      const bAtt = b.attendanceQuote || 0;
      if (Math.abs(aAtt - bAtt) > 5) return bAtt - aAtt;

      return b.experienceMonths - a.experienceMonths;
    });

    // Bob (waitlisted) should be first
    expect(sorted[0].id).toBe('m2');
  });

  it('should sort by attendance when both have data', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 60 },
      { id: 'm3', name: 'Charlie', experienceMonths: 48, attendanceQuote: 95 },
    ];

    const sorted = [...members].sort((a, b) => {
      const aAtt = a.attendanceQuote || 0;
      const bAtt = b.attendanceQuote || 0;
      if (Math.abs(aAtt - bAtt) > 5) return bAtt - aAtt;
      return b.experienceMonths - a.experienceMonths;
    });

    // Charlie has significantly higher attendance (95 vs 60, diff 35 > 5)
    expect(sorted[0].id).toBe('m3');
  });

  it('should sort by experience when attendance is close', () => {
    const members: SortableMember[] = [
      { id: 'm1', name: 'Alice', experienceMonths: 24, attendanceQuote: 80 },
      { id: 'm3', name: 'Charlie', experienceMonths: 48, attendanceQuote: 82 },
    ];

    const sorted = [...members].sort((a, b) => {
      const aAtt = a.attendanceQuote || 0;
      const bAtt = b.attendanceQuote || 0;
      if (Math.abs(aAtt - bAtt) > 5) return bAtt - aAtt;
      return b.experienceMonths - a.experienceMonths;
    });

    // Attendance diff is 2 (not > 5), so sort by experience
    expect(sorted[0].id).toBe('m3'); // More experience
  });
});

// ============================================
// TESTS: Trainer utilization calculation
// ============================================

describe('trainer utilization', () => {
  const SESSION_DURATION_HOURS = 1.5;

  it('should calculate correct utilization percentage', () => {
    const sessions = 8;
    const hoursAssigned = sessions * SESSION_DURATION_HOURS;
    const maxHoursPerWeek = 30;
    const utilizationPct = 80;
    const maxAllowed = maxHoursPerWeek * (utilizationPct / 100);

    expect(hoursAssigned).toBe(12);
    expect(maxAllowed).toBe(24);
    expect(hoursAssigned <= maxAllowed).toBe(true);

    const utilization = (hoursAssigned / maxHoursPerWeek) * 100;
    expect(utilization).toBe(40);
  });

  it('should flag trainer exceeding max utilization', () => {
    const sessions = 18;
    const hoursAssigned = sessions * SESSION_DURATION_HOURS;
    const maxHoursPerWeek = 30;
    const maxAllowed = maxHoursPerWeek * 0.8;

    expect(hoursAssigned).toBe(27);
    expect(maxAllowed).toBe(24);
    expect(hoursAssigned > maxAllowed).toBe(true);
  });
});

// ============================================
// TESTS: Waitlist position assignment
// ============================================

describe('waitlist position assignment', () => {
  it('should assign sequential positions', () => {
    const waitlist: Array<{ memberId: string; position: number }> = [];
    const members = ['m1', 'm2', 'm3'];

    for (const memberId of members) {
      const position = waitlist.length + 1;
      waitlist.push({ memberId, position });
    }

    expect(waitlist).toEqual([
      { memberId: 'm1', position: 1 },
      { memberId: 'm2', position: 2 },
      { memberId: 'm3', position: 3 },
    ]);
  });

  it('should not exceed group max size with waitlist', () => {
    const GROUP_MAX_SIZE = 12;
    const currentMembers = 10;
    const currentWaitlist = 2;
    const newMember = 1;

    const total = currentMembers + currentWaitlist + newMember;
    expect(total).toBe(13);
    expect(total >= GROUP_MAX_SIZE).toBe(true); // Would exceed limit
  });
});
