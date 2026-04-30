'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  closestCenter,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clock, User, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analytics } from '@/lib/analytics';

const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Session {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  trainerId: string;
  trainerName?: string;
  groupIds: string[];
  groupNames?: string[];
  maxParticipants: number;
  notes?: string;
}

interface ScheduleData {
  scheduleId: string;
  clubId: string;
  sessions: Session[];
}

export default function SchedulerPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const res = await fetch('/api/schedule?clubId=demo-club');
      const data = await res.json();
      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error || 'Failed to load schedule');
      }
      setSchedule(data as ScheduleData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const session = schedule?.sessions.find((s) => s.id === event.active.id);
    setActiveSession(session || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSession(null);

    if (!over || !schedule) return;

    const activeSession = schedule.sessions.find((s) => s.id === active.id);
    if (!activeSession) return;

    // Parse drop target id: "slot-{dayIdx}-{time}"
    const parts = over.id.toString().split('-');
    if (parts.length < 3) return;
    const dayIdx = parseInt(parts[1], 10);
    const time = parts.slice(2).join('-'); // rejoin in case time contains '-'

    // Only update if day or time changed
    if (dayIdx + 1 === activeSession.dayOfWeek && time === activeSession.startTime) {
      return;
    }

    const newDayOfWeek = dayIdx + 1; // API: 1=Mon, 7=Sun
    const newStartTime = time;

    // Update local state optimistically
    const updatedSessions = schedule.sessions.map((s) =>
      s.id === activeSession.id ? { ...s, dayOfWeek: newDayOfWeek, startTime: newStartTime } : s
    );
    setSchedule({ ...schedule, sessions: updatedSessions });

    // Persist change
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: schedule.scheduleId,
          sessions: updatedSessions.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            trainerId: s.trainerId,
            groupIds: s.groupIds,
            maxParticipants: s.maxParticipants,
            notes: s.notes,
          })),
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Termin verschoben');
    } catch {
      toast.error('Fehler beim Speichern');
      loadSchedule(); // revert
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch('/api/schedule/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: 'demo-club' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Optimization failed');
      setSchedule(data.schedule || schedule); // API may return updated schedule
      toast.success('Stundenplan optimiert');
      analytics.scheduleOptimized('demo-club');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Optimierung fehlgeschlagen';
      toast.error(message);
      analytics.trackEvent('schedule_optimize_failed', { error: message, clubId: 'demo-club' });
    } finally {
      setOptimizing(false);
    }
  };

  // Build matrix: days (7) x time slots
  const getSessionsForSlot = (dayIdx: number, time: string) => {
    if (!schedule) return [];
    return schedule.sessions.filter((s) => s.dayOfWeek === dayIdx + 1 && s.startTime === time);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1B4332]"></div>
      </div>
    );
  }

  if (!schedule) {
    return <div className="text-red-500">Kein Stundenplan gefunden.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Stundenplan</h1>
          <p className="text-gray-500">Club: Demo Club – Drag & Drop zum Verschieben</p>
        </div>
        <Button
          onClick={handleOptimize}
          disabled={optimizing}
          variant="accent"
          className="flex items-center gap-2"
        >
          <Sparkles size={16} />
          {optimizing ? 'Optimiere...' : 'KI-Optimierung'}
        </Button>
      </div>

      {/* DnD Context wraps both grid and session list so all draggables are inside */}
      <DndContext
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Schedule Grid */}
        <Card variant="elevated" padding="none" className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header row with days */}
            <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
              <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-200">
                Uhrzeit
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="p-3 text-sm font-semibold text-center text-brand-primary border-r border-gray-200 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots rows */}
            {TIME_SLOTS.map((time) => (
              <div key={time} className="grid grid-cols-8 border-b border-gray-200 last:border-b-0">
                <div className="p-2 text-sm text-gray-500 border-r border-gray-200 text-center bg-gray-50">
                  {time}
                </div>
                {DAYS.map((_, dayIdx) => {
                  const sessions = getSessionsForSlot(dayIdx, time);
                  const dropId = `slot-${dayIdx}-${time}`;
                  return (
                    <DropZone
                      key={dropId}
                      id={dropId}
                      dayIdx={dayIdx}
                      time={time}
                      sessions={sessions}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <DragOverlay>
          {activeSession ? <SessionCard session={activeSession} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Sessions Legend */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-brand-primary">Alle Sessions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedule.sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Drop Zone Component
function DropZone({
  id,
  dayIdx,
  time,
  sessions,
}: {
  id: string;
  dayIdx: number;
  time: string;
  sessions: Session[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { dayIdx, time },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] border-r border-gray-200 last:border-r-0 p-2 transition-colors ${
        isOver ? 'bg-[#2D6A4F]/10' : 'hover:bg-gray-50'
      }`}
    >
      {sessions.map((session) => (
        <DraggableSessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}

// Draggable Session Card
function DraggableSessionCard({ session }: { session: Session }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SessionCard session={session} compact />
    </div>
  );
}

// Session Card UI
function SessionCard({
  session,
  compact = false,
  dragging = false,
}: {
  session: Session;
  compact?: boolean;
  dragging?: boolean;
}) {
  const timeDisplay = `${session.startTime} – ${session.endTime}`;
  const bgColor = 'bg-white border-l-4 border-l-[#40916C] shadow-sm';
  const dragHandle = <GripVertical size={14} className="text-gray-400" />;

  if (compact || dragging) {
    return (
      <div
        className={`${bgColor} rounded p-2 mb-1 hover:shadow-md transition-shadow ${
          dragging ? 'rotate-2 shadow-lg' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-brand-primary truncate">
              {session.groupNames?.[0] || 'Gruppe'}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {session.trainerName || session.trainerId.slice(0, 6)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-400">{dragHandle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} rounded-lg p-4 hover:shadow-lg transition-all`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {dragHandle}
          <span className="text-sm font-semibold text-brand-primary">
            {session.groupNames?.[0] || 'Gruppe'}
          </span>
        </div>
        <Badge variant="success" size="sm">
          {session.maxParticipants} Plätze
        </Badge>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock size={14} />
          <span>{timeDisplay}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <User size={14} />
          <span>{session.trainerName || session.trainerId}</span>
        </div>
        {session.notes && <div className="text-xs text-gray-500 italic mt-2">{session.notes}</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {session.groupNames?.slice(1).map((name) => (
          <Badge key={name} variant="secondary" size="sm">
            {name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
