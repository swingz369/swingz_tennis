// Custom hook for schedule plan state management
// dnd-kit handles drag-and-drop directly in ScheduleGrid component
import { useState, useCallback } from 'react';
import type { ScheduleSlot } from './types';

export function useSchedulePlan() {
  const [plan, setPlan] = useState<ScheduleSlot[]>([]);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  /** Move a member from one slot to another (used by GroupListView) */
  const moveMember = useCallback(
    (fromId: string, personId: string, personName: string, toId: string) => {
      setPlan((p) =>
        p.map((slot) => {
          if (slot.id === fromId)
            return {
              ...slot,
              memberIds: slot.memberIds.filter((x) => x !== personId),
              memberNames: slot.memberNames.filter((x) => x !== personName),
            };
          if (slot.id === toId)
            return {
              ...slot,
              memberIds: [...slot.memberIds, personId],
              memberNames: [...slot.memberNames, personName],
            };
          return slot;
        })
      );
    },
    []
  );

  /** Move a slot to a new day/time (called by dnd-kit onDragEnd or edit modal) */
  const slotMove = useCallback((slotId: string, newDay: number, newStartTime: string) => {
    setPlan((p) =>
      p.map((s) => {
        if (s.id !== slotId) return s;
        const [sh, sm] = newStartTime.split(':').map(Number);
        const tot = sh * 60 + sm + s.durationMin;
        const newEnd = `${Math.floor(tot / 60)
          .toString()
          .padStart(2, '0')}:${(tot % 60).toString().padStart(2, '0')}`;
        return { ...s, dayOfWeek: newDay, startTime: newStartTime, endTime: newEnd };
      })
    );
  }, []);

  /** Update a slot in-place (called by edit modal for trainer/court/time changes) */
  const slotUpdate = useCallback((updated: ScheduleSlot) => {
    setPlan((p) => p.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  // Group plan by day of week
  const byDay = useCallback((): Record<number, ScheduleSlot[]> => {
    const groups: Record<number, ScheduleSlot[]> = {};
    for (let d = 1; d <= 7; d++) groups[d] = [];
    plan.forEach((s) => {
      const day = s.dayOfWeek === 0 ? 7 : s.dayOfWeek;
      if (!groups[day]) groups[day] = [];
      groups[day].push(s);
    });
    return groups;
  }, [plan]);

  const activeDays = useCallback((): number[] => {
    const groups = byDay();
    return [1, 2, 3, 4, 5, 6, 7].filter((d) => groups[d]?.length > 0);
  }, [byDay]);

  return {
    plan,
    setPlan,
    expandedSlot,
    setExpandedSlot,
    moveMember,
    slotMove,
    slotUpdate,
    byDay,
    activeDays,
  };
}
