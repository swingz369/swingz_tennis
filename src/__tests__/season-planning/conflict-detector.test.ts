import { describe, it, expect } from 'vitest';

// ============================================
// PURE FUNCTIONS (extracted for testability)
// ============================================

function timeStringToMinutes(time: string): number {
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
// TESTS: Conflict detection logic with mock data
// ============================================

interface MockAssignment {
  groupId: string;
  groupName: string;
  trainerId: string;
  trainerName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courtId: string | null;
  courtName: string | null;
  memberIds: string[];
  memberDetails: Array<{
    memberId: string;
    memberName: string;
    niveauMatch: number;
    wishPartnerFulfilled: boolean;
  }>;
  warnings: string[];
}

describe('trainer double-booking detection', () => {
  it('should detect when a trainer is assigned to two groups at the same time', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Intermediate Gruppe 1',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 2, // Wednesday
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: 'Court 1',
        memberIds: ['m1', 'm2'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 85, wishPartnerFulfilled: false },
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 85, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
      {
        groupId: 'g2',
        groupName: 'Advanced Gruppe 1',
        trainerId: 't1', // Same trainer!
        trainerName: 'Trainer A',
        dayOfWeek: 2, // Same day
        startTime: '17:00', // Same time
        endTime: '18:30',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m3', 'm4'],
        memberDetails: [
          { memberId: 'm3', memberName: 'Charlie', niveauMatch: 90, wishPartnerFulfilled: false },
          { memberId: 'm4', memberName: 'Diana', niveauMatch: 90, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    // Simulate the conflict check logic
    const seen = new Map<string, MockAssignment[]>();
    for (const a of assignments) {
      const key = `${a.trainerId}_${a.dayOfWeek}_${a.startTime}`;
      const existing = seen.get(key) || [];
      existing.push(a);
      seen.set(key, existing);
    }

    const doubleBookings = [...seen.values()].filter((g) => g.length > 1);
    expect(doubleBookings.length).toBe(1);
    expect(doubleBookings[0][0].trainerName).toBe('Trainer A');
  });

  it('should not flag trainer with different time slots', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Group 1',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: 'Court 1',
        memberIds: ['m1'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
      {
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 2,
        startTime: '18:30', // Back-to-back, no overlap
        endTime: '20:00',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m2'],
        memberDetails: [
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const seen = new Map<string, MockAssignment[]>();
    for (const a of assignments) {
      const key = `${a.trainerId}_${a.dayOfWeek}_${a.startTime}`;
      const existing = seen.get(key) || [];
      existing.push(a);
      seen.set(key, existing);
    }

    const doubleBookings = [...seen.values()].filter((g) => g.length > 1);
    expect(doubleBookings.length).toBe(0);
  });
});

describe('member double-booking detection', () => {
  it('should detect member in two overlapping groups', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Group 1',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 3,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: 'Court 1',
        memberIds: ['m1', 'm2'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 85, wishPartnerFulfilled: false },
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 85, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
      {
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        dayOfWeek: 3,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c2',
        courtName: 'Court 2',
        memberIds: ['m1', 'm3'], // m1 is in both!
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 90, wishPartnerFulfilled: false },
          { memberId: 'm3', memberName: 'Charlie', niveauMatch: 90, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const memberGroups = new Map<string, MockAssignment[]>();
    for (const a of assignments) {
      for (const mid of a.memberIds) {
        const existing = memberGroups.get(mid) || [];
        existing.push(a);
        memberGroups.set(mid, existing);
      }
    }

    const multiGroupMembers = [...memberGroups.entries()].filter(([, groups]) => groups.length > 1);

    expect(multiGroupMembers.length).toBe(1);
    expect(multiGroupMembers[0][0]).toBe('m1');

    // Check time overlap
    const [_mid, groups] = multiGroupMembers[0];
    const overlaps =
      groups[0].dayOfWeek === groups[1].dayOfWeek &&
      timeSlotsOverlap(
        groups[0].startTime,
        groups[0].endTime,
        groups[1].startTime,
        groups[1].endTime
      );
    expect(overlaps).toBe(true);
  });
});

describe('no trainer assigned detection', () => {
  it('should detect group without trainer', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Group 1',
        trainerId: '',
        trainerName: '',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: 'Court 1',
        memberIds: ['m1'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const noTrainer = assignments.filter((a) => !a.trainerId || a.trainerId === '');
    expect(noTrainer.length).toBe(1);
    expect(noTrainer[0].groupName).toBe('Group 1');
  });

  it('should pass when all groups have trainers', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Group 1',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: null,
        memberIds: ['m1'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const noTrainer = assignments.filter((a) => !a.trainerId || a.trainerId === '');
    expect(noTrainer.length).toBe(0);
  });
});

describe('trainer over limit detection', () => {
  it('should detect trainer exceeding weekly hour limit', () => {
    const trainerSessions = new Map<string, number>();
    const assignments: MockAssignment[] = [];

    // Simulate 15 sessions for one trainer (15 * 1.5h = 22.5h)
    for (let i = 0; i < 15; i++) {
      assignments.push({
        groupId: `g${i}`,
        groupName: `Group ${i}`,
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: i % 7,
        startTime: '17:00',
        endTime: '18:30',
        courtId: null,
        courtName: null,
        memberIds: [`m${i}`],
        memberDetails: [
          {
            memberId: `m${i}`,
            memberName: `Member ${i}`,
            niveauMatch: 80,
            wishPartnerFulfilled: false,
          },
        ],
        warnings: [],
      });
    }

    for (const a of assignments) {
      trainerSessions.set(a.trainerId, (trainerSessions.get(a.trainerId) || 0) + 1);
    }

    const sessions = trainerSessions.get('t1') || 0;
    const hoursAssigned = sessions * 1.5;
    const maxHours = 20 * 0.8; // 20h max * 80% = 16h

    expect(sessions).toBe(15);
    expect(hoursAssigned).toBe(22.5);
    expect(hoursAssigned > maxHours).toBe(true);
  });

  it('should pass when trainer is within limits', () => {
    const sessions = 10; // 10 sessions * 1.5h = 15h
    const hoursAssigned = sessions * 1.5;
    const maxHours = 20 * 0.8; // 16h

    expect(hoursAssigned).toBe(15);
    expect(hoursAssigned <= maxHours).toBe(true);
  });
});

describe('court double-booking detection', () => {
  it('should detect same court booked twice at same time', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Group 1',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 4,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1',
        courtName: 'Court 1',
        memberIds: ['m1'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
      {
        groupId: 'g2',
        groupName: 'Group 2',
        trainerId: 't2',
        trainerName: 'Trainer B',
        dayOfWeek: 4,
        startTime: '17:00',
        endTime: '18:30',
        courtId: 'c1', // Same court!
        courtName: 'Court 1',
        memberIds: ['m2'],
        memberDetails: [
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 80, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const courtSlotMap = new Map<string, MockAssignment[]>();
    for (const a of assignments) {
      if (!a.courtId) continue;
      const key = `${a.courtId}_${a.dayOfWeek}_${a.startTime}`;
      const existing = courtSlotMap.get(key) || [];
      existing.push(a);
      courtSlotMap.set(key, existing);
    }

    const doubleBooked = [...courtSlotMap.values()].filter((g) => g.length > 1);
    expect(doubleBooked.length).toBe(1);
    expect(doubleBooked[0][0].courtName).toBe('Court 1');
  });
});

describe('large niveau span detection', () => {
  it('should detect when warnings contain niveau span violation', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Mixed Level Group',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '18:30',
        courtId: null,
        courtName: null,
        memberIds: ['m1', 'm2', 'm3'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 60, wishPartnerFulfilled: false },
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 60, wishPartnerFulfilled: false },
          { memberId: 'm3', memberName: 'Charlie', niveauMatch: 40, wishPartnerFulfilled: false },
        ],
        warnings: ['Niveau-Spanne (1-48 Monate) überschreitet Maximum (4)'],
      },
    ];

    const niveauViolations = assignments.filter((a) =>
      a.warnings.some((w) => w.includes('Niveau-Spanne'))
    );
    expect(niveauViolations.length).toBe(1);
  });

  it('should pass when no niveau warnings', () => {
    const assignments: MockAssignment[] = [
      {
        groupId: 'g1',
        groupName: 'Homogeneous Group',
        trainerId: 't1',
        trainerName: 'Trainer A',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '18:30',
        courtId: null,
        courtName: null,
        memberIds: ['m1', 'm2'],
        memberDetails: [
          { memberId: 'm1', memberName: 'Alice', niveauMatch: 95, wishPartnerFulfilled: false },
          { memberId: 'm2', memberName: 'Bob', niveauMatch: 95, wishPartnerFulfilled: false },
        ],
        warnings: [],
      },
    ];

    const niveauViolations = assignments.filter((a) =>
      a.warnings.some((w) => w.includes('Niveau-Spanne'))
    );
    expect(niveauViolations.length).toBe(0);
  });
});
