// Custom hook for schedule plan state management and drag-and-drop
// Adapted from TSOWAPP useSchedulePlan
import { useState, useCallback } from 'react';
import type { ScheduleSlot } from './types';

export function useSchedulePlan() {
  const [plan, setPlan] = useState<ScheduleSlot[]>([]);
  const [dragging, setDragging] = useState<ScheduleSlot | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

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

  const drop = useCallback(
    (e: React.DragEvent, day: number, hour: string) => {
      e.preventDefault();
      if (!dragging) return;
      const [sh, sm] = hour.split(':').map(Number);
      const tot = sh * 60 + sm + dragging.durationMin;
      const newEnd = `${Math.floor(tot / 60)
        .toString()
        .padStart(2, '0')}:${(tot % 60).toString().padStart(2, '0')}`;
      setPlan((p) =>
        p.map((s) =>
          s.id === dragging.id ? { ...s, dayOfWeek: day, startTime: hour, endTime: newEnd } : s
        )
      );
      setDragging(null);
      setDragOver(null);
    },
    [dragging]
  );

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
    dragging,
    setDragging,
    dragOver,
    setDragOver,
    expandedSlot,
    setExpandedSlot,
    moveMember,
    drop,
    byDay,
    activeDays,
  };
}
