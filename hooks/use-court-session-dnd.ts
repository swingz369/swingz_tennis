import { useCallback, useState } from 'react';
import { useSensor, useSensors, KeyboardCode, KeyboardSensor, PointerSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { getSessionForSlot } from '@/lib/court-calendar-utils';
import type { Session } from '@/hooks/use-sessions';

/** Drag & Drop einer Session auf einen anderen Platz/Zeit-Slot (Admin) —
 *  Wochen- und Tagesansicht droppen auf IDs im Format
 *  `${courtId}::${isoDate}::${HH:MM}`. */
export function useCourtSessionDnd(sessions: Session[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Nur Leertaste greift eine Session — Enter bleibt für „öffnen"/„entsperren"
    // reserviert (siehe onKeyDown in PositionedSessionBlock). Mit den
    // dnd-kit-Standardcodes (Space + Enter) würde Enter beide Aktionen zugleich
    // auslösen.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space],
      },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      const session = sessions.find((s: Session) => s.id === event.active.id);
      setDraggedSession(session ?? null);
    },
    [sessions]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { over } = event;
      setActiveId(null);
      setDraggedSession(null);
      if (!over || !activeId) return;

      const targetId = over.id as string;
      // Both daily and weekly views use '::' separator (safe for ISO dates)
      const parts = targetId.split('::');
      const targetCourtId = parts[0];
      const targetTimeSlot = parts[parts.length - 1];
      const targetDateStr = parts.slice(1, -1).join('::');
      if (!targetCourtId || !targetDateStr || !targetTimeSlot) {
        toast.error('Ungültiges Ziel');
        return;
      }

      const targetDate = new Date(targetDateStr);
      const session = sessions.find((s: Session) => s.id === activeId);
      if (!session) return;

      const existing = getSessionForSlot(targetCourtId, targetDate, targetTimeSlot, sessions);
      if (existing && existing.id !== activeId) {
        toast.error('Dieser Platz ist bereits belegt');
        return;
      }

      const [startH, startM] = session.startTime.split(':').map(Number);
      const [endH, endM] = session.endTime.split(':').map(Number);
      const durationMs = (endH * 60 + endM - (startH * 60 + startM)) * 60_000;
      const [newH, newM] = targetTimeSlot.split(':').map(Number);
      const newEnd = new Date(0, 0, 0, newH, newM, 0, 0);
      newEnd.setTime(newEnd.getTime() + durationMs);
      const endTimeStr = `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}`;

      try {
        const res = await apiFetch(`/api/sessions/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courtId: targetCourtId,
            dayOfWeek: targetDate.getDay(),
            startTime: targetTimeSlot,
            endTime: endTimeStr,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(extractErrorMessage(err) || 'Update failed');
        }
        toast.success(`Session verschoben nach ${targetTimeSlot}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Fehler beim Verschieben');
      }
    },
    [activeId, sessions]
  );

  return { activeId, draggedSession, sensors, handleDragStart, handleDragEnd };
}
