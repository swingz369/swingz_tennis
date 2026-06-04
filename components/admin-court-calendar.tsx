'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  getDay as dateFnsGetDay,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Clock, GripVertical, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useUserClub, useUserRoles } from '@/hooks/use-user-data';
import { useCourts } from '@/hooks/use-courts';
import { useSessions, type Session } from '@/hooks/use-sessions';
import { useSeasonPlanGrid } from '@/hooks/use-season-plan-entries';
import { CALENDAR_TIME_SLOTS as TIME_SLOTS } from '@/lib/court-calendar-utils';
import {
  CourtCalendarHeader,
  CourtCalendarGrid,
  WeekDaysHeaderRow,
  CourtRowHeader,
  CourtCalendarLegend,
} from '@/components/court-calendar-shared';

interface AdminCourtCalendarProps {
  onBookCourt?: (courtId: string, date: Date, startTime: string, endTime: string) => void;
  initialClubId?: string;
}

const ADMIN_LEGEND_ITEMS = [
  { label: 'Verfügbar', className: 'bg-green-50 border border-dashed border-green-300' },
  { label: 'Session (verschiebbar)', className: 'bg-blue-50 border border-blue-200' },
  { label: 'Saisonplan (Gruppe)', className: 'bg-purple-50 border border-purple-200' },
  { label: 'Gebucht', className: 'bg-red-50 border border-red-200' },
];

interface DraggableSessionProps {
  session: Session;
  isDragging?: boolean;
}

function DraggableSession({ session, isDragging }: DraggableSessionProps) {
  return (
    <div
      className={`p-1 rounded text-[11px] transition-colors cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'opacity-50 rotate-2 scale-105 shadow-lg'
          : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1">
          <GripVertical className="h-3 w-3 text-gray-400" />
          <div className="font-medium truncate">
            {session.trainerName?.substring(0, 8) || 'Trainer'}
          </div>
        </div>
        {session.bookedByUser && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-gray-600">
        <Clock className="h-3 w-3" />
        <span>
          {session.startTime} - {session.endTime}
        </span>
      </div>
    </div>
  );
}

function PlanEntryCard({
  entry,
}: {
  entry: {
    id: string;
    group_name: string;
    group_color: string;
    trainer_name: string;
    start_time: string;
    end_time: string;
  };
}) {
  return (
    <Link
      href="/admin/seasons"
      className="block p-1 rounded text-[11px] text-white hover:opacity-90 transition-opacity cursor-pointer"
      style={{ backgroundColor: entry.group_color }}
      title={`${entry.group_name} · ${entry.trainer_name} · ${entry.start_time}–${entry.end_time}`}
    >
      <div className="font-semibold truncate leading-tight">{entry.group_name}</div>
      <div className="opacity-80 text-[10px] leading-tight">
        {entry.start_time}–{entry.end_time}
      </div>
    </Link>
  );
}

export default function AdminCourtCalendar({
  onBookCourt: _onBookCourt,
  initialClubId,
}: AdminCourtCalendarProps) {
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSession, setDraggedSession] = useState<any>(null);
  const [showSeasonPlan, setShowSeasonPlan] = useState(true);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  const { data: clubData } = useUserClub();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();

  const clubId = clubData?.clubId ?? initialClubId ?? null;

  const isAdmin = userRoles.some((r) => r === 'admin' || r === 'superadmin');

  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);

  // Fetch active season for plan entries
  const { data: seasonPlanData } = useSeasonPlanGrid(activeSeasonId);
  const planSlots = useMemo(() => seasonPlanData?.slots ?? [], [seasonPlanData]);

  // Find the latest published/active season
  useEffect(() => {
    if (!clubId) return;
    const fetchActiveSeason = async () => {
      try {
        const res = await fetch(`/api/seasons?clubId=${clubId}`);
        if (res.ok) {
          const data = await res.json();
          const seasons = data.seasons ?? [];
          const active = seasons.find(
            (s: any) => s.is_active && ['published', 'active'].includes(s.planning_status)
          );
          if (active) {
            setActiveSeasonId(active.id);
          } else {
            const published = seasons.find((s: any) =>
              ['published', 'active', 'completed'].includes(s.planning_status)
            );
            if (published) setActiveSeasonId(published.id);
          }
        }
      } catch {}
    };
    fetchActiveSeason();
  }, [clubId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const jsDayToApiDay = (jsDay: number) => (jsDay === 0 ? 7 : jsDay);

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  const getSessionForCourtAndTime = useCallback(
    (courtId: string, date: Date, timeSlot: string) => {
      const [hour, minute] = timeSlot.split(':').map(Number);
      const slotStart = setMinutes(setHours(date, hour), minute);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      return sessions.find((session: Session) => {
        if (!session.courtId || session.courtId !== courtId) return false;
        if (!session.week) return false;

        const sessionDate = new Date(session.week);
        const [startHour, startMinute] = session.startTime.split(':').map(Number);
        const [endHour, endMinute] = session.endTime.split(':').map(Number);

        const sessionStart = setMinutes(setHours(sessionDate, startHour), startMinute);
        const sessionEnd = setMinutes(setHours(sessionDate, endHour), endMinute);

        return (
          isSameDay(sessionDate, date) &&
          (isBefore(slotStart, sessionEnd) || slotStart.getTime() === sessionStart.getTime()) &&
          (isAfter(slotEnd, sessionStart) || slotEnd.getTime() === sessionEnd.getTime())
        );
      });
    },
    [sessions]
  );

  const getPlanEntriesForCourtAndDay = useCallback(
    (courtId: string, dayOfWeek: number) => {
      const apiDay = jsDayToApiDay(dayOfWeek);
      return planSlots.filter((slot: any) => {
        return slot.court_id === courtId && slot.day_of_week === apiDay;
      });
    },
    [planSlots]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      const session = sessions.find((s: Session) => s.id === active.id);
      setDraggedSession(session);
    },
    [sessions]
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {}, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { over } = event;
      setActiveId(null);
      setDraggedSession(null);

      if (!over || !activeId) return;

      const targetId = over.id as string;
      const [targetCourtId, targetDateStr, targetTimeSlot] = targetId.split('-');

      if (!targetCourtId || !targetDateStr || !targetTimeSlot) {
        toast.error('Ungültiges Ziel');
        return;
      }

      const targetDate = new Date(targetDateStr);
      const session = sessions.find((s: Session) => s.id === activeId);

      if (!session) {
        toast.error('Session nicht gefunden');
        return;
      }

      const existingSession = getSessionForCourtAndTime(targetCourtId, targetDate, targetTimeSlot);
      if (existingSession && existingSession.id !== activeId) {
        toast.error('Dieser Platz ist bereits belegt');
        return;
      }

      const [startHour, startMin] = session.startTime.split(':').map(Number);
      const [endHour, endMin] = session.endTime.split(':').map(Number);
      const oldStart = new Date(session.week);
      oldStart.setHours(startHour, startMin, 0, 0);
      const oldEnd = new Date(oldStart);
      oldEnd.setHours(endHour, endMin, 0, 0);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStartDate = new Date(targetDate);
      const [newHour, newMin] = targetTimeSlot.split(':').map(Number);
      newStartDate.setHours(newHour, newMin, 0, 0);
      const newEndDate = new Date(newStartDate.getTime() + durationMs);
      const endTimeStr = `${String(newEndDate.getHours()).padStart(2, '0')}:${String(newEndDate.getMinutes()).padStart(2, '0')}`;

      try {
        const response = await fetch(`/api/sessions/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courtId: targetCourtId,
            dayOfWeek: targetDate.getDay(),
            startTime: targetTimeSlot,
            endTime: endTimeStr,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update session');
        }

        await response.json();
        toast.success(
          `Session verschoben nach ${targetCourtId} am ${format(targetDate, 'dd.MM', { locale: de })} um ${targetTimeSlot}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Fehler beim Verschieben';
        toast.error(message);
      }
    },
    [activeId, sessions, getSessionForCourtAndTime]
  );

  if (rolesLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-600">
          Zugriff verweigert. Diese Funktion ist nur für Administratoren verfügbar.
        </div>
      </div>
    );
  }

  if (courtsLoading || sessionsLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Keine Plätze gefunden</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <CourtCalendarHeader
          title="Admin Platz-Kalender"
          subtitle="Drag & Drop zum Verschieben von Sessions"
          weekStart={weekStart}
          weekEnd={weekEnd}
          onGoPrevious={goToPreviousWeek}
          onGoNext={goToNextWeek}
          onGoToday={goToToday}
          onGoDaily={() => router.push('/courts/daily')}
        >
          <Button
            variant={showSeasonPlan ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSeasonPlan(!showSeasonPlan)}
            className="gap-1.5"
          >
            <MapPin className="h-4 w-4" />
            Saisonplan
          </Button>
        </CourtCalendarHeader>

        <CourtCalendarGrid>
          <WeekDaysHeaderRow weekDays={weekDays} />

          {courts.map((court) => (
            <div key={court.id} className="border-b border-gray-200 last:border-b-0">
              <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-gray-100">
                <CourtRowHeader court={court} />
                {weekDays.map((day) => {
                  const planEntriesForCourtDay = showSeasonPlan
                    ? getPlanEntriesForCourtAndDay(court.id, dateFnsGetDay(day))
                    : [];

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-1 min-h-[300px] bg-white ${
                        isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Season plan entries (top, before sessions) */}
                      {showSeasonPlan && planEntriesForCourtDay.length > 0 && (
                        <div className="space-y-0.5 mb-1">
                          {planEntriesForCourtDay.map((entry: any) => (
                            <PlanEntryCard key={entry.id} entry={entry} />
                          ))}
                        </div>
                      )}

                      {/* Sessions grid */}
                      <div className="space-y-0.5">
                        {TIME_SLOTS.map((timeSlot) => {
                          const session = getSessionForCourtAndTime(court.id, day, timeSlot);
                          const dropTargetId = `${court.id}-${day.toISOString()}-${timeSlot}`;

                          return (
                            <div
                              key={timeSlot}
                              id={dropTargetId}
                              className={`h-6 rounded text-[11px] flex items-center justify-center transition-colors ${
                                session
                                  ? 'bg-transparent'
                                  : planEntriesForCourtDay.length > 0
                                    ? 'bg-purple-50/40 text-purple-400 border border-dashed border-purple-200'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-dashed border-green-300'
                              }`}
                            >
                              {session ? (
                                <DraggableSession
                                  session={session}
                                  isDragging={activeId === session.id}
                                />
                              ) : (
                                <span className="text-[11px] opacity-50">{timeSlot}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CourtCalendarGrid>

        <CourtCalendarLegend items={ADMIN_LEGEND_ITEMS} />
      </div>

      <DragOverlay>
        {activeId && draggedSession ? (
          <DraggableSession session={draggedSession} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
