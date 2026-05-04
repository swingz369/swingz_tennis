'use client';

import { useState, useCallback } from 'react';
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
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import { useCourts } from '@/hooks/use-courts';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
  useUpdateBookingStatus,
} from '@/hooks/use-sessions';

interface AdminCourtCalendarProps {
  onBookCourt?: (courtId: string, date: Date, startTime: string, endTime: string) => void;
}

const TIME_SLOTS = [
  '06:00',
  '07:00',
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
  '21:00',
  '22:00',
];

interface DraggableSessionProps {
  session: any;
  isDragging?: boolean;
}

function DraggableSession({ session, isDragging }: DraggableSessionProps) {
  return (
    <div
      className={`p-2 rounded text-xs transition-colors cursor-grab active:cursor-grabbing ${
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

export default function AdminCourtCalendar({ onBookCourt }: AdminCourtCalendarProps) {
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSession, setDraggedSession] = useState<any>(null);

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();
  const { data: userRoles = [] } = useUserRoles();

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const isAdmin = userRoles.some((r) => r === 'admin' || r === 'superadmin');

  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  const getSessionForCourtAndTime = useCallback(
    (courtId: string, date: Date, timeSlot: string) => {
      const [hour, minute] = timeSlot.split(':').map(Number);
      const slotStart = setMinutes(setHours(date, hour), minute);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      return sessions.find((session) => {
        if (!session.courtId || session.courtId !== courtId) return false;

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

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      const session = sessions.find((s) => s.id === active.id);
      setDraggedSession(session);
    },
    [sessions]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drag over visual feedback if needed
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setDraggedSession(null);

      if (!over || !activeId) return;

      // Parse the drop target ID (format: courtId-date-timeSlot)
      const targetId = over.id as string;
      const [targetCourtId, targetDateStr, targetTimeSlot] = targetId.split('-');

      if (!targetCourtId || !targetDateStr || !targetTimeSlot) {
        toast.error('Ungültiges Ziel');
        return;
      }

      const targetDate = new Date(targetDateStr);
      const session = sessions.find((s) => s.id === activeId);

      if (!session) {
        toast.error('Session nicht gefunden');
        return;
      }

      // Check if the target slot is available
      const existingSession = getSessionForCourtAndTime(targetCourtId, targetDate, targetTimeSlot);
      if (existingSession && existingSession.id !== activeId) {
        toast.error('Dieser Platz ist bereits belegt');
        return;
      }

      // Here you would typically call an API to update the session
      // For now, we'll just show a success message
      toast.success(
        `Session verschoben nach ${targetCourtId} am ${format(targetDate, 'dd.MM', { locale: de })} um ${targetTimeSlot}`
      );

      // TODO: Implement actual session update API call
      // await updateSession({
      //   sessionId: activeId,
      //   courtId: targetCourtId,
      //   date: targetDate,
      //   startTime: targetTimeSlot,
      //   endTime: calculateEndTime(targetTimeSlot, session.duration)
      // });
    },
    [activeId, sessions, getSessionForCourtAndTime]
  );

  const handleBookSlot = useCallback(
    (courtId: string, date: Date, timeSlot: string) => {
      if (!memberId || !clubId) {
        toast.error('Member-ID oder Club-ID nicht verfügbar');
        return;
      }

      const session = getSessionForCourtAndTime(courtId, date, timeSlot);
      if (session) {
        if (onBookCourt) {
          onBookCourt(courtId, date, timeSlot, session.endTime);
        } else {
          createBooking.mutate({ memberId, sessionId: session.id, clubId });
        }
      } else {
        toast.error('Keine Session für diesen Zeitplatz gefunden');
      }
    },
    [memberId, clubId, createBooking, getSessionForCourtAndTime, onBookCourt]
  );

  const handleCancelBooking = useCallback(
    (sessionId: string, bookingId: string) => {
      if (!clubId) return;
      cancelBooking.mutate({ bookingId, sessionId, clubId });
    },
    [clubId, cancelBooking]
  );

  const getSurfaceLabel = (surface: string) => {
    const labels: Record<string, string> = {
      clay: 'Sand',
      grass: 'Rasen',
      hard: 'Hartplatz',
      carpet: 'Teppich',
    };
    return labels[surface] || surface;
  };

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Admin Platz-Kalender</h1>
            <p className="text-gray-500">Drag & Drop zum Verschieben von Sessions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/courts/daily')}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Tagesansicht
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Heute
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center font-medium text-sm md:text-base">
              {format(weekStart, 'dd.MM', { locale: de })} -{' '}
              {format(weekEnd, 'dd.MM.yyyy', { locale: de })}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[800px]">
            {/* Time slots header */}
            <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-gray-200 rounded-t-lg overflow-hidden">
              <div className="bg-gray-50 p-2 text-center font-semibold text-gray-700 text-xs">
                Platz
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className="bg-gray-50 p-2 text-center font-semibold text-gray-700 text-xs"
                >
                  <div>{format(day, 'EEE', { locale: de })}</div>
                  <div className="text-[10px] text-gray-500">{format(day, 'dd.MM')}</div>
                </div>
              ))}
            </div>

            {/* Court rows */}
            {courts.map((court) => (
              <div key={court.id} className="border-b border-gray-200 last:border-b-0">
                {/* Court header */}
                <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-gray-100">
                  <div className="bg-white p-2 flex items-center gap-2 border-r border-gray-200">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{court.name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span>{getSurfaceLabel(court.surface)}</span>
                        {court.hasIndoor && <span>• Indoor</span>}
                      </div>
                    </div>
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`p-1 min-h-[300px] bg-white ${
                        isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Time slots for this day */}
                      <div className="space-y-0.5">
                        {TIME_SLOTS.map((timeSlot) => {
                          const session = getSessionForCourtAndTime(court.id, day, timeSlot);
                          const dropTargetId = `${court.id}-${day.toISOString()}-${timeSlot}`;

                          return (
                            <div
                              key={timeSlot}
                              id={dropTargetId}
                              className={`h-6 rounded text-[10px] flex items-center justify-center transition-colors ${
                                session
                                  ? 'bg-transparent'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-dashed border-green-300'
                              }`}
                            >
                              {session ? (
                                <DraggableSession
                                  session={session}
                                  isDragging={activeId === session.id}
                                />
                              ) : (
                                <span className="text-[9px] opacity-50">{timeSlot}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-dashed border-green-300 rounded"></div>
            <span>Verfügbar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Session (verschiebbar)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Gebucht</span>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId && draggedSession ? (
          <DraggableSession session={draggedSession} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
