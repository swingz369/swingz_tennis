import { describe, it, expect } from 'vitest';
import {
  timeStringToMinutes,
  timeSlotsOverlap,
  detectNoCourtAssigned,
  detectTrainerDoubleBookings,
  detectMemberDoubleBookings,
  detectNoTrainerAssignments,
  detectCourtDoubleBookings,
  detectTrainerOverLimit,
  detectLargeNiveauSpan,
} from '@/lib/season-planning/conflict-utils';
import type { ExistingPlanEntry } from '@/lib/season-planning/conflict-utils';
import type { GroupAssignment } from '@/lib/season-planning/types';

// ============================================
// FIXTURES
// ============================================

function makeAssignment(overrides: Partial<GroupAssignment> = {}): GroupAssignment {
  return {
    groupId: 'g1',
    groupName: 'Intermediate Gruppe 1',
    trainerId: 't1',
    trainerName: 'Trainer A',
    dayOfWeek: 2,
    startTime: '17:00',
    endTime: '18:30',
    courtId: 'c1',
    courtName: 'Court 1',
    maxSize: 6,
    memberIds: ['m1', 'm2'],
    memberDetails: [
      {
        memberId: 'm1',
        memberName: 'Alice',
        niveauMatch: 85,
        experienceMonths: 6,
        groupExperienceSpan: '4-8 Monate',
        wishPartnerFulfilled: false,
        wishPartnerNames: [],
        isPromoted: false,
        assignmentReason: 'Verfügbarkeit passt',
      },
      {
        memberId: 'm2',
        memberName: 'Bob',
        niveauMatch: 85,
        experienceMonths: 8,
        groupExperienceSpan: '4-8 Monate',
        wishPartnerFulfilled: false,
        wishPartnerNames: [],
        isPromoted: false,
        assignmentReason: 'Verfügbarkeit passt',
      },
    ],
    waitlistIds: [],
    waitlistDetails: [],
    warnings: [],
    conflictIds: [],
    ...overrides,
  };
}

// ============================================
// TESTS: timeStringToMinutes
// ============================================

describe('timeStringToMinutes', () => {
  it('should convert HH:MM to total minutes', () => {
    expect(timeStringToMinutes('08:00')).toBe(480);
    expect(timeStringToMinutes('12:30')).toBe(750);
    expect(timeStringToMinutes('20:00')).toBe(1200);
  });

  it('should handle HH:MM:SS format', () => {
    expect(timeStringToMinutes('09:30:00')).toBe(570);
    expect(timeStringToMinutes('18:00:00')).toBe(1080);
  });

  it('should handle midnight', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
  });
});

// ============================================
// TESTS: timeSlotsOverlap
// ============================================

describe('timeSlotsOverlap', () => {
  it('should detect overlapping slots', () => {
    // 08:00-10:00 overlaps with 09:00-11:00
    expect(timeSlotsOverlap('08:00', '10:00', '09:00', '11:00')).toBe(true);
    // 08:00-10:00 completely contains 08:30-09:30
    expect(timeSlotsOverlap('08:00', '10:00', '08:30', '09:30')).toBe(true);
    // 09:00-11:00 overlaps with 08:00-10:00 (reverse)
    expect(timeSlotsOverlap('09:00', '11:00', '08:00', '10:00')).toBe(true);
  });

  it('should not overlap when slots are adjacent', () => {
    // 08:00-09:00 is followed by 09:00-10:00 (back-to-back, no overlap)
    expect(timeSlotsOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
  });

  it('should not overlap when slots are separated', () => {
    expect(timeSlotsOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
    expect(timeSlotsOverlap('10:00', '11:00', '08:00', '09:00')).toBe(false);
  });

  it('should handle identical slots as overlapping', () => {
    expect(timeSlotsOverlap('14:00', '15:30', '14:00', '15:30')).toBe(true);
  });

  it('should detect partial overlap at edges', () => {
    // 08:00-10:00 overlaps with 09:30-11:00
    expect(timeSlotsOverlap('08:00', '10:00', '09:30', '11:00')).toBe(true);
    // 09:30-11:00 overlaps with 08:00-10:00
    expect(timeSlotsOverlap('09:30', '11:00', '08:00', '10:00')).toBe(true);
  });
});

// ============================================
// TESTS: no court assigned
// ============================================

describe('detectNoCourtAssigned', () => {
  it('should flag assignments without a court', () => {
    const assignments = [makeAssignment({ groupId: 'g1', courtId: null, courtName: null })];
    expect(detectNoCourtAssigned(assignments)).toHaveLength(1);
  });

  it('should pass when all groups have a court', () => {
    const assignments = [makeAssignment({ courtId: 'c1', courtName: 'Court 1' })];
    expect(detectNoCourtAssigned(assignments)).toHaveLength(0);
  });
});

// ============================================
// TESTS: trainer double-booking
// ============================================

describe('detectTrainerDoubleBookings', () => {
  it('should detect when a trainer is assigned to two groups at the same time', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', groupName: 'Intermediate Gruppe 1' }),
      makeAssignment({
        groupId: 'g2',
        groupName: 'Advanced Gruppe 1',
        trainerId: 't1', // Same trainer!
        trainerName: 'Trainer A',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m3', 'm4'],
      }),
    ];

    const doubleBookings = detectTrainerDoubleBookings(assignments);
    expect(doubleBookings).toHaveLength(1);
    expect(doubleBookings[0]).toHaveLength(2);
    expect(doubleBookings[0][0].trainerName).toBe('Trainer A');
  });

  it('should not flag trainer with different time slots', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', startTime: '17:00', endTime: '18:30' }),
      makeAssignment({
        groupId: 'g2',
        startTime: '18:30', // Back-to-back, no overlap
        endTime: '20:00',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m2'],
      }),
    ];

    expect(detectTrainerDoubleBookings(assignments)).toHaveLength(0);
  });

  it('should not conflate different trainers', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', trainerId: 't1', trainerName: 'Trainer A' }),
      makeAssignment({
        groupId: 'g2',
        trainerId: 't2', // different trainer
        trainerName: 'Trainer B',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m3', 'm4'],
      }),
    ];

    expect(detectTrainerDoubleBookings(assignments)).toHaveLength(0);
  });

  it('should flag two assignments that overlap the same existing plan entry', () => {
    // Plan entries key by the entry's startTime, so a single overlapping
    // assignment would only fill a length-1 bucket. Two assignments that both
    // overlap the same entry land in the same bucket → flagged.
    const assignments = [
      makeAssignment({ groupId: 'g1', startTime: '17:00', endTime: '18:30' }),
      makeAssignment({
        groupId: 'g2',
        groupName: 'Group 2',
        startTime: '17:15',
        endTime: '18:45',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m3', 'm4'],
      }),
    ];
    const existingPlanEntries: ExistingPlanEntry[] = [
      {
        trainer_id: 't1', // same trainer
        court_id: null,
        day_of_week: 2,
        start_time: '17:30', // overlaps both assignments
        end_time: '19:00',
      },
    ];

    const doubleBookings = detectTrainerDoubleBookings(assignments, existingPlanEntries);
    expect(doubleBookings).toHaveLength(1);
    expect(doubleBookings[0]).toHaveLength(2);
  });
});

// ============================================
// TESTS: member double-booking
// ============================================

describe('detectMemberDoubleBookings', () => {
  it('should detect member in two overlapping groups', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', memberIds: ['m1', 'm2'] }),
      makeAssignment({
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m1', 'm3'], // m1 is in both!
      }),
    ];

    const findings = detectMemberDoubleBookings(assignments);
    expect(findings).toHaveLength(1);
    expect(findings[0].memberId).toBe('m1');
  });

  it('should not flag member in groups on different days', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', dayOfWeek: 2, memberIds: ['m1'] }),
      makeAssignment({
        groupId: 'g2',
        dayOfWeek: 3, // different day
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m1'],
      }),
    ];

    expect(detectMemberDoubleBookings(assignments)).toHaveLength(0);
  });

  it('should not flag member in groups with non-overlapping times on the same day', () => {
    const assignments = [
      makeAssignment({
        groupId: 'g1',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '18:30',
        memberIds: ['m1'],
      }),
      makeAssignment({
        groupId: 'g2',
        dayOfWeek: 2,
        startTime: '19:00', // no overlap with 17:00-18:30
        endTime: '20:30',
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m1'],
      }),
    ];

    expect(detectMemberDoubleBookings(assignments)).toHaveLength(0);
  });
});

// ============================================
// TESTS: no trainer assigned
// ============================================

describe('detectNoTrainerAssignments', () => {
  it('should detect group without trainer', () => {
    const assignments = [makeAssignment({ groupId: 'g1', trainerId: '', trainerName: '' })];
    const noTrainer = detectNoTrainerAssignments(assignments);
    expect(noTrainer).toHaveLength(1);
    expect(noTrainer[0].groupName).toBe('Intermediate Gruppe 1');
  });

  it('should pass when all groups have trainers', () => {
    const assignments = [makeAssignment({ groupId: 'g1' })];
    expect(detectNoTrainerAssignments(assignments)).toHaveLength(0);
  });
});

// ============================================
// TESTS: trainer over limit
// ============================================

describe('detectTrainerOverLimit', () => {
  const config = { slotDurationMinutes: 90, trainerUtilizationMaxPct: 80 };

  it('should detect trainer exceeding weekly hour limit', () => {
    // 15 sessions à 1.5h = 22.5h > 20h * 80% = 16h
    const assignments = Array.from({ length: 15 }, (_, i) =>
      makeAssignment({
        groupId: `g${i}`,
        groupName: `Group ${i}`,
        dayOfWeek: i % 7,
        memberIds: [`m${i}`],
      })
    );
    const trainers = [{ id: 't1', name: 'Trainer A', max_hours_per_week: 20 }];

    const findings = detectTrainerOverLimit(assignments, trainers, config);
    expect(findings).toHaveLength(1);
    expect(findings[0].sessions).toBe(15);
    expect(findings[0].hoursAssigned).toBe(22.5);
    expect(findings[0].maxHours).toBe(16);
  });

  it('should pass when trainer is within limits', () => {
    // 10 sessions à 1.5h = 15h ≤ 16h
    const assignments = Array.from({ length: 10 }, (_, i) =>
      makeAssignment({ groupId: `g${i}`, dayOfWeek: i % 7, memberIds: [`m${i}`] })
    );
    const trainers = [{ id: 't1', name: 'Trainer A', max_hours_per_week: 20 }];

    expect(detectTrainerOverLimit(assignments, trainers, config)).toHaveLength(0);
  });

  it('should respect configured slot duration (60min slots)', () => {
    // 10 sessions à 1h = 10h > 10h * 80% = 8h
    const assignments = Array.from({ length: 10 }, (_, i) =>
      makeAssignment({ groupId: `g${i}`, dayOfWeek: i % 7, memberIds: [`m${i}`] })
    );
    const trainers = [{ id: 't1', name: 'Trainer A', max_hours_per_week: 10 }];

    const findings = detectTrainerOverLimit(assignments, trainers, {
      slotDurationMinutes: 60,
      trainerUtilizationMaxPct: 80,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].hoursAssigned).toBe(10);
    expect(findings[0].maxHours).toBe(8);
  });

  it('should not flag trainers without sessions', () => {
    const trainers = [
      { id: 't1', name: 'Trainer A', max_hours_per_week: 20 },
      { id: 't2', name: 'Trainer B', max_hours_per_week: 5 },
    ];
    expect(detectTrainerOverLimit([], trainers, config)).toHaveLength(0);
  });
});

// ============================================
// TESTS: court double-booking
// ============================================

describe('detectCourtDoubleBookings', () => {
  it('should detect same court booked twice at same time', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', courtId: 'c1', courtName: 'Court 1' }),
      makeAssignment({
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c1', // Same court!
        courtName: 'Court 1',
        memberIds: ['m2'],
      }),
    ];

    const doubleBooked = detectCourtDoubleBookings(assignments);
    expect(doubleBooked).toHaveLength(1);
    expect(doubleBooked[0][0].courtName).toBe('Court 1');
  });

  it('should not flag different courts', () => {
    const assignments = [
      makeAssignment({ groupId: 'g1', courtId: 'c1', courtName: 'Court 1' }),
      makeAssignment({
        groupId: 'g2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m2'],
      }),
    ];

    expect(detectCourtDoubleBookings(assignments)).toHaveLength(0);
  });

  it('should flag two assignments that overlap the same existing plan entry', () => {
    // Plan entries key by the entry's startTime, so a single overlapping
    // assignment would only fill a length-1 bucket. Two assignments that both
    // overlap the same entry land in the same bucket → flagged.
    const assignments = [
      makeAssignment({
        groupId: 'g1',
        courtId: 'c1',
        courtName: 'Court 1',
        startTime: '17:00',
        endTime: '18:30',
      }),
      makeAssignment({
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        courtId: 'c1',
        courtName: 'Court 1',
        startTime: '17:15',
        endTime: '18:45',
        memberIds: ['m2'],
      }),
    ];
    const existingPlanEntries: ExistingPlanEntry[] = [
      {
        trainer_id: 't9',
        court_id: 'c1', // same court
        day_of_week: 2,
        start_time: '17:30', // overlaps both assignments
        end_time: '19:00',
      },
    ];

    const doubleBooked = detectCourtDoubleBookings(assignments, existingPlanEntries);
    expect(doubleBooked).toHaveLength(1);
    expect(doubleBooked[0]).toHaveLength(2);
  });
});

// ============================================
// TESTS: large niveau span
// ============================================

describe('detectLargeNiveauSpan', () => {
  it('should detect when warnings contain niveau span violation', () => {
    const assignments = [
      makeAssignment({
        groupId: 'g1',
        groupName: 'Mixed Level Group',
        warnings: ['Niveau-Spanne (1-48 Monate) überschreitet Maximum (4)'],
      }),
    ];

    expect(detectLargeNiveauSpan(assignments)).toHaveLength(1);
  });

  it('should pass when no niveau warnings', () => {
    const assignments = [makeAssignment({ groupId: 'g1', groupName: 'Homogeneous Group' })];
    expect(detectLargeNiveauSpan(assignments)).toHaveLength(0);
  });
});
