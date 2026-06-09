import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchedulePlan } from '@/lib/season-planning/use-schedule-plan';
import type { ScheduleSlot } from '@/lib/season-planning/types';

// ---- Test data factories ----

function makeSlot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: 'slot-1',
    groupName: 'Gruppe A',
    groupColor: '#3B82F6',
    trainerId: 't1',
    trainerName: 'Trainer Müller',
    dayOfWeek: 1, // Monday
    startTime: '17:00',
    endTime: '18:30',
    durationMin: 90,
    courtId: 'c1',
    courtName: 'Platz 1',
    memberIds: ['m1', 'm2'],
    memberNames: ['Alice', 'Bob'],
    ...overrides,
  };
}

function makePlan(): ScheduleSlot[] {
  return [
    makeSlot({
      id: 'slot-1',
      groupName: 'Gruppe A',
      dayOfWeek: 1,
      startTime: '17:00',
      memberIds: ['m1', 'm2'],
      memberNames: ['Alice', 'Bob'],
    }),
    makeSlot({
      id: 'slot-2',
      groupName: 'Gruppe B',
      dayOfWeek: 1,
      startTime: '18:30',
      memberIds: ['m3', 'm4'],
      memberNames: ['Charlie', 'Diana'],
    }),
    makeSlot({
      id: 'slot-3',
      groupName: 'Gruppe C',
      dayOfWeek: 2,
      startTime: '17:00',
      memberIds: ['m5', 'm6'],
      memberNames: ['Eve', 'Frank'],
    }),
  ];
}

// ============================================
// TESTS: Initial state
// ============================================

describe('useSchedulePlan — initial state', () => {
  it('should return empty plan by default', () => {
    const { result } = renderHook(() => useSchedulePlan());
    expect(result.current.plan).toEqual([]);
  });

  it('should have null expandedSlot by default', () => {
    const { result } = renderHook(() => useSchedulePlan());
    expect(result.current.expandedSlot).toBeNull();
  });

  it('should not expose dragging/dragOver/drop in the public API (dnd-kit handles it externally)', () => {
    const { result } = renderHook(() => useSchedulePlan());
    expect(result.current).not.toHaveProperty('dragging');
    expect(result.current).not.toHaveProperty('dragOver');
    expect(result.current).not.toHaveProperty('drop');
  });

  it('should expose slotMove and slotUpdate in the public API', () => {
    const { result } = renderHook(() => useSchedulePlan());
    expect(typeof result.current.slotMove).toBe('function');
    expect(typeof result.current.slotUpdate).toBe('function');
  });

  it('should allow setting plan via setPlan', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    expect(result.current.plan).toEqual(plan);
  });
});

// ============================================
// TESTS: moveMember
// ============================================

describe('useSchedulePlan — moveMember', () => {
  it('should move a member from one slot to another', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    // Move Alice (m1) from slot-1 to slot-2
    act(() => {
      result.current.moveMember('slot-1', 'm1', 'Alice', 'slot-2');
    });

    const updated = result.current.plan;
    const slot1 = updated.find((s) => s.id === 'slot-1')!;
    const slot2 = updated.find((s) => s.id === 'slot-2')!;

    expect(slot1.memberIds).toEqual(['m2']);
    expect(slot1.memberNames).toEqual(['Bob']);
    expect(slot2.memberIds).toEqual(['m3', 'm4', 'm1']);
    expect(slot2.memberNames).toEqual(['Charlie', 'Diana', 'Alice']);
  });

  it('should not mutate other slots', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    act(() => {
      result.current.moveMember('slot-1', 'm1', 'Alice', 'slot-2');
    });

    // Slot 3 should be untouched
    const slot3 = result.current.plan.find((s) => s.id === 'slot-3')!;
    expect(slot3.memberIds).toEqual(['m5', 'm6']);
    expect(slot3.memberNames).toEqual(['Eve', 'Frank']);
  });

  it('should remove member only when fromId matches, but still add to toId', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    // Move a member that exists in slot-1 to slot-2, but use a different fromId
    act(() => {
      result.current.moveMember('slot-99', 'm1', 'Alice', 'slot-2');
    });

    // Slot-1 should still have Alice (fromId didn't match → no removal)
    const slot1 = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(slot1.memberIds).toContain('m1');

    // Slot-2 SHOULD now have Alice (toId matched → added)
    const slot2 = result.current.plan.find((s) => s.id === 'slot-2')!;
    expect(slot2.memberIds).toContain('m1');
  });

  it('should add member only when toId matches', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    act(() => {
      result.current.moveMember('slot-1', 'm1', 'Alice', 'slot-99');
    });

    // Slot-1 should have removed Alice
    const slot1 = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(slot1.memberIds).not.toContain('m1');

    // No slot received Alice (toId didn't match)
    const allMemberIds = result.current.plan.flatMap((s) => s.memberIds);
    expect(allMemberIds).not.toContain('m1');
  });
});

// ============================================
// TESTS: slotMove (replaces old drop function)
// ============================================

describe('useSchedulePlan — slotMove', () => {
  it('should update slot day and startTime', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    // Move slot-1 to Wednesday 14:00
    act(() => {
      result.current.slotMove('slot-1', 3, '14:00');
    });

    const movedSlot = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(movedSlot.dayOfWeek).toBe(3);
    expect(movedSlot.startTime).toBe('14:00');
    expect(movedSlot.endTime).toBe('15:30'); // 14:00 + 90 min
  });

  it('should derive endTime from startTime + durationMin', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const longSlot = makeSlot({
      id: 'slot-long',
      durationMin: 120,
      startTime: '08:00',
      endTime: '10:00',
    });

    act(() => {
      result.current.setPlan([longSlot]);
    });

    act(() => {
      result.current.slotMove('slot-long', 5, '20:30');
    });

    const moved = result.current.plan[0];
    expect(moved.startTime).toBe('20:30');
    // 20:30 + 120min = 22:30
    expect(moved.endTime).toBe('22:30');
  });

  it('should not affect other slots', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    act(() => {
      result.current.slotMove('slot-1', 3, '14:00');
    });

    const slot2 = result.current.plan.find((s) => s.id === 'slot-2')!;
    const slot3 = result.current.plan.find((s) => s.id === 'slot-3')!;
    expect(slot2.dayOfWeek).toBe(1);
    expect(slot2.startTime).toBe('18:30');
    expect(slot3.dayOfWeek).toBe(2);
    expect(slot3.startTime).toBe('17:00');
  });

  it('should be a no-op when slotId does not match any plan entry', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    act(() => {
      result.current.slotMove('non-existent', 3, '14:00');
    });

    // Plan should be unchanged
    expect(result.current.plan).toEqual(plan);
  });

  it('should preserve memberIds, memberNames, and other fields during move', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    act(() => {
      result.current.slotMove('slot-1', 4, '19:00');
    });

    const movedSlot = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(movedSlot.memberIds).toEqual(['m1', 'm2']);
    expect(movedSlot.memberNames).toEqual(['Alice', 'Bob']);
    expect(movedSlot.groupName).toBe('Gruppe A');
    expect(movedSlot.trainerId).toBe('t1');
    expect(movedSlot.durationMin).toBe(90);
  });
});

// ============================================
// TESTS: slotUpdate (in-place edit via modal)
// ============================================

describe('useSchedulePlan — slotUpdate', () => {
  it('should replace the matching slot with the provided updated slot', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    const updated = makeSlot({
      id: 'slot-1',
      trainerName: 'Trainer Schmidt',
      startTime: '16:00',
      endTime: '17:30',
    });

    act(() => {
      result.current.slotUpdate(updated);
    });

    const slot1 = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(slot1.trainerName).toBe('Trainer Schmidt');
    expect(slot1.startTime).toBe('16:00');
    expect(slot1.endTime).toBe('17:30');
  });

  it('should not modify other slots', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    const updated = makeSlot({ id: 'slot-1', trainerName: 'Trainer Neu' });

    act(() => {
      result.current.slotUpdate(updated);
    });

    const slot2 = result.current.plan.find((s) => s.id === 'slot-2')!;
    const slot3 = result.current.plan.find((s) => s.id === 'slot-3')!;
    expect(slot2.trainerName).toBe('Trainer Müller');
    expect(slot3.trainerName).toBe('Trainer Müller');
  });

  it('should be a no-op when updated.id does not match any plan entry', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    const updated = makeSlot({ id: 'non-existent', trainerName: 'Ghost' });

    act(() => {
      result.current.slotUpdate(updated);
    });

    expect(result.current.plan).toEqual(plan);
  });
});

// ============================================
// TESTS: byDay
// ============================================

describe('useSchedulePlan — byDay', () => {
  it('should group slots by day of week', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    const grouped = result.current.byDay();

    // Monday (1): slot-1, slot-2
    expect(grouped[1]).toHaveLength(2);
    expect(grouped[1][0].id).toBe('slot-1');
    expect(grouped[1][1].id).toBe('slot-2');

    // Tuesday (2): slot-3
    expect(grouped[2]).toHaveLength(1);
    expect(grouped[2][0].id).toBe('slot-3');

    // Other days should be empty arrays
    expect(grouped[3]).toEqual([]);
    expect(grouped[4]).toEqual([]);
    expect(grouped[5]).toEqual([]);
    expect(grouped[6]).toEqual([]);
    expect(grouped[7]).toEqual([]);
  });

  it('should map dayOfWeek 0 (Sunday) to group 7', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const sundaySlot = makeSlot({ id: 'sun', dayOfWeek: 0, groupName: 'Sunday Group' });

    act(() => {
      result.current.setPlan([sundaySlot]);
    });

    const grouped = result.current.byDay();
    expect(grouped[7]).toHaveLength(1);
    expect(grouped[7][0].id).toBe('sun');
    // Day 0 should be empty
    expect(grouped[0]).toBeUndefined();
  });

  it('should return all 7 days initialized with empty arrays', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const grouped = result.current.byDay();
    expect(Object.keys(grouped)).toHaveLength(7);
    for (let d = 1; d <= 7; d++) {
      expect(grouped[d]).toEqual([]);
    }
  });
});

// ============================================
// TESTS: activeDays
// ============================================

describe('useSchedulePlan — activeDays', () => {
  it('should return days that have slots', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan(); // Monday (1) + Tuesday (2)

    act(() => {
      result.current.setPlan(plan);
    });

    const active = result.current.activeDays();
    expect(active).toEqual([1, 2]);
  });

  it('should return empty array when plan is empty', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const active = result.current.activeDays();
    expect(active).toEqual([]);
  });

  it('should include Sunday (7) when dayOfWeek is 0', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const sundaySlot = makeSlot({ id: 'sun', dayOfWeek: 0 });
    act(() => {
      result.current.setPlan([sundaySlot]);
    });

    const active = result.current.activeDays();
    expect(active).toContain(7);
  });

  it('should update after slotMove changes the day', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    // Move slot-1 from Monday to Friday
    act(() => {
      result.current.slotMove('slot-1', 5, '17:00');
    });

    const active = result.current.activeDays();
    expect(active).toContain(1); // slot-2 still on Monday
    expect(active).toContain(2); // slot-3 still on Tuesday
    expect(active).toContain(5); // slot-1 moved to Friday
  });
});

// ============================================
// TESTS: setExpandedSlot
// ============================================

describe('useSchedulePlan — expandedSlot', () => {
  it('should set and toggle expandedSlot', () => {
    const { result } = renderHook(() => useSchedulePlan());

    act(() => {
      result.current.setExpandedSlot('slot-1');
    });
    expect(result.current.expandedSlot).toBe('slot-1');

    act(() => {
      result.current.setExpandedSlot(null);
    });
    expect(result.current.expandedSlot).toBeNull();
  });
});
