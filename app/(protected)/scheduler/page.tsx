'use client';

import { useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clock, User, GripVertical, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useSchedule,
  useUpdateSchedule,
  useOptimizeSchedule,
  type Session,
} from '@/hooks/use-schedule';
import { useUserRoles, useUserClub } from '@/hooks/use-user-data';
import { useCurrentUser } from '@/hooks/use-current-user';

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

export default function SchedulerPage() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId || '';

  const { data: schedule, isLoading, error } = useSchedule(clubId);
  const updateSchedule = useUpdateSchedule();
  const optimizeSchedule = useOptimizeSchedule();

  const { data: user } = useCurrentUser();
  const { data: roles = [] } = useUserRoles();
  const isAdmin = roles.includes('admin') || roles.includes('superadmin');
  const isTrainer = roles.includes('trainer');

  const canDragSession = (session: Session) => {
    if (isAdmin) return true;
    if (isTrainer && user?.userId === session.trainerId) return true;
    return false;
  };

  // Draggable Session Card component (inner to access canDragSession)
  function DraggableSessionCard({ session }: { session: Session }) {
    const canDrag = canDragSession(session);
    const draggable = useDraggable({
      id: session.id,
      disabled: !canDrag,
    });

    const style = draggable.transform
      ? { transform: CSS.Transform.toString(draggable.transform) }
      : undefined;

    const { attributes, listeners, setNodeRef, isDragging } = draggable;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-2 rounded text-xs transition-colors ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50 rotate-2 scale-105 shadow-lg' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1">
            {canDrag && <GripVertical className="h-3 w-3 text-muted-foreground" />}
            <div className="font-medium truncate">
              {session.trainerName?.substring(0, 8) || 'Trainer'}
            </div>
          </div>
          {session.bookedByUser && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {session.startTime} - {session.endTime}
          </span>
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
        className={`min-h-[60px] border-r border-border last:border-r-0 p-2 transition-colors ${
          isOver ? 'bg-brand-light/10' : 'hover:bg-muted'
        }`}
      >
        {sessions.map((session) => (
          <DraggableSessionCard key={session.id} session={session} />
        ))}
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const session = schedule?.sessions.find((s) => s.id === event.active.id);
    setActiveSession(session || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSession(null);

    if (!over || !schedule) return;

    const activeSession = schedule.sessions.find((s) => s.id === active.id);
    if (!activeSession) return;

    const parts = over.id.toString().split('-');
    if (parts.length < 3) return;
    const dayIdx = parseInt(parts[1], 10);
    const time = parts.slice(2).join('-');

    if (dayIdx + 1 === activeSession.dayOfWeek && time === activeSession.startTime) {
      return;
    }

    const newDayOfWeek = dayIdx + 1;
    const newStartTime = time;

    // Create updated sessions array with the moved session
    const updatedSessions = schedule.sessions.map((s) =>
      s.id === activeSession.id ? { ...s, dayOfWeek: newDayOfWeek, startTime: newStartTime } : s
    );

    // Call update mutation – this updates the entire schedule via PUT /api/schedule
    updateSchedule.mutate({
      scheduleId: schedule.scheduleId,
      sessions: updatedSessions,
      clubId: schedule.clubId,
    });
  };

  const handleOptimize = () => {
    if (clubId) {
      optimizeSchedule.mutate({ clubId });
    }
  };

  // Build matrix: days (7) x time slots
  const getSessionsForSlot = (dayIdx: number, time: string) => {
    if (!schedule) return [];
    return schedule.sessions.filter((s) => s.dayOfWeek === dayIdx + 1 && s.startTime === time);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-semibold text-brand-primary">Noch kein Stundenplan vorhanden</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Der Stundenplan wird nach der Saisonplanung vom Administrator veröffentlicht.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Stundenplan</h1>
          <p className="text-muted-foreground">Club: Demo Club – Drag & Drop zum Verschieben</p>
        </div>
        <Button
          onClick={handleOptimize}
          disabled={optimizeSchedule.isPending}
          variant="accent"
          className="flex items-center gap-2"
        >
          <Sparkles size={16} />
          {optimizeSchedule.isPending ? 'Optimiere...' : 'KI-Optimierung'}
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
          <div className="min-w-[768px]">
            {/* Header row with days */}
            <div className="grid grid-cols-8 border-b border-border bg-muted">
              <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">
                Uhrzeit
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="p-3 text-sm font-semibold text-center text-brand-primary border-r border-border last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots rows */}
            {TIME_SLOTS.map((time) => (
              <div key={time} className="grid grid-cols-8 border-b border-border last:border-b-0">
                <div className="p-2 text-sm text-muted-foreground border-r border-border text-center bg-muted">
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
  const bgColor = 'bg-background border-l-4 border-l-brand-light shadow-sm';
  const dragHandle = <GripVertical size={14} className="text-muted-foreground" />;

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
            <div className="text-[11px] text-muted-foreground truncate">
              {session.trainerName || session.trainerId.slice(0, 6)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">{dragHandle}</div>
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
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock size={14} />
          <span>{timeDisplay}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User size={14} />
          <span>{session.trainerName || session.trainerId}</span>
        </div>
        {session.notes && (
          <div className="text-xs text-muted-foreground italic mt-2">{session.notes}</div>
        )}
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
