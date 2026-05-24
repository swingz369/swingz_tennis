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

  it('should have null dragging, dragOver, and expandedSlot by default', () => {
    const { result } = renderHook(() => useSchedulePlan());
    expect(result.current.dragging).toBeNull();
    expect(result.current.dragOver).toBeNull();
    expect(result.current.expandedSlot).toBeNull();
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
    // The member is NOT removed from slot-1 (fromId doesn't match) but IS added to slot-2 (toId matches)
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
// TESTS: drop
// ============================================

describe('useSchedulePlan — drop', () => {
  it('should update slot day and time on drop', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
    });

    // Set dragging to slot-1
    act(() => {
      result.current.setDragging(plan[0]); // slot-1 with 90min duration
    });

    // Drop on Wednesday 14:00
    const mockEvent = { preventDefault: () => {} } as React.DragEvent;
    act(() => {
      result.current.drop(mockEvent, 3, '14:00');
    });

    const droppedSlot = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(droppedSlot.dayOfWeek).toBe(3);
    expect(droppedSlot.startTime).toBe('14:00');
    expect(droppedSlot.endTime).toBe('15:30'); // 14:00 + 90 min
  });

  it('should reset dragging and dragOver after drop', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
      result.current.setDragging(plan[0]);
      result.current.setDragOver('day-hour');
    });

    const mockEvent = { preventDefault: () => {} } as React.DragEvent;
    act(() => {
      result.current.drop(mockEvent, 3, '14:00');
    });

    expect(result.current.dragging).toBeNull();
    expect(result.current.dragOver).toBeNull();
  });

  it('should do nothing when no slot is dragging', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const plan = makePlan();

    act(() => {
      result.current.setPlan(plan);
      // No setDragging — dragging is null
    });

    const mockEvent = { preventDefault: () => {} } as React.DragEvent;
    act(() => {
      result.current.drop(mockEvent, 3, '14:00');
    });

    // Plan should be unchanged
    const slot1 = result.current.plan.find((s) => s.id === 'slot-1')!;
    expect(slot1.dayOfWeek).toBe(1);
    expect(slot1.startTime).toBe('17:00');
  });

  it('should calculate endTime correctly across hour boundaries', () => {
    const { result } = renderHook(() => useSchedulePlan());

    const longSlot = makeSlot({
      id: 'slot-long',
      durationMin: 120,
      startTime: '08:00',
      endTime: '10:00',
    });

    act(() => {
      result.current.setPlan([longSlot]);
      result.current.setDragging(longSlot);
    });

    const mockEvent = { preventDefault: () => {} } as React.DragEvent;
    act(() => {
      result.current.drop(mockEvent, 5, '20:30');
    });

    const dropped = result.current.plan[0];
    expect(dropped.startTime).toBe('20:30');
    // 20:30 + 120min = 22:30, but HOURS max is 21:00 → actually hours go to 21:00 + 1 = 22:00
    // The drop function calculates endTime: tot = 20*60 + 30 + 120 = 1350 → 22:30
    expect(dropped.endTime).toBe('22:30');
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
});

// ============================================
// TESTS: setDragging / setDragOver / setExpandedSlot
// ============================================

describe('useSchedulePlan — drag state setters', () => {
  it('should set and clear dragging slot', () => {
    const { result } = renderHook(() => useSchedulePlan());
    const slot = makeSlot();

    act(() => {
      result.current.setDragging(slot);
    });
    expect(result.current.dragging).toEqual(slot);

    act(() => {
      result.current.setDragging(null);
    });
    expect(result.current.dragging).toBeNull();
  });

  it('should set and change dragOver cell key', () => {
    const { result } = renderHook(() => useSchedulePlan());

    act(() => {
      result.current.setDragOver('1-17:00');
    });
    expect(result.current.dragOver).toBe('1-17:00');

    act(() => {
      result.current.setDragOver('2-18:00');
    });
    expect(result.current.dragOver).toBe('2-18:00');
  });

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
