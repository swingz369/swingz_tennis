'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
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
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  getDay as dateFnsGetDay,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import {
  Download,
  MapPin,
  GripVertical,
  Clock,
  User,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Wrench,
  PartyPopper,
  List,
} from 'lucide-react';
import CourtBookingsList from '@/components/court-bookings-list';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import { useCourts } from '@/hooks/use-courts';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
  type Session,
} from '@/hooks/use-sessions';
import { useSeasonPlanGrid } from '@/hooks/use-season-plan-entries';
import { exportSessionsToICS } from '@/lib/calendar-export';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  getSurfaceLabel,
  getSessionForSlot,
  getSlotStatus,
  SLOT_STATUS_STYLES,
} from '@/lib/court-calendar-utils';
import {
  CourtCalendarHeader,
  CourtCalendarGrid,
  WeekDaysHeaderRow,
  CourtRowHeader,
  CourtCalendarLegend,
} from '@/components/court-calendar-shared';
import { apiFetch } from '@/lib/api-fetch';

/* ─────────────────── Types ─────────────────── */

type ViewMode = 'weekly' | 'daily' | 'list';

interface SeasonInfo {
  id: string;
  is_active: boolean;
  planning_status: string;
}

interface UnifiedCourtCalendarProps {
  /** Override view mode (default: weekly) */
  defaultView?: ViewMode;
  /** Override club ID (for admin pages) */
  initialClubId?: string;
}

/* ─────────────────── Legend items ─────────────────── */

function getLegendItems(isAdmin: boolean) {
  const items = [
    { label: 'Verfügbar', className: 'bg-green-50 border border-green-200' },
    { label: 'Gruppentraining', className: 'bg-purple-50 border border-purple-200' },
  ];

  if (isAdmin) {
    items.push({ label: 'Session (Drag & Drop)', className: 'bg-blue-50 border border-blue-200' });
    items.push({ label: 'Gesperrt', className: 'bg-muted border border-border' });
  } else {
    items.push({ label: 'Training', className: 'bg-muted border border-border' });
    items.push({ label: 'Belegt', className: 'bg-orange-50 border border-orange-200' });
    items.push({ label: 'Deine Buchung', className: 'bg-red-50 border border-red-200' });
  }

  return items;
}

/* ─────────────────── Draggable Session (Admin) ─────────────────── */

function DraggableSessionCard({ session, isDragging }: { session: Session; isDragging?: boolean }) {
  return (
    <div
      className={`p-1 rounded text-[11px] transition-colors ${
        isDragging
          ? 'opacity-50 rotate-2 scale-105 shadow-lg bg-blue-100'
          : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1">
          <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <div className="font-medium truncate">
            {session.trainerName?.substring(0, 8) || 'Trainer'}
          </div>
        </div>
        {session.bookedByUser && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {session.startTime} - {session.endTime}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────── Plan Entry Badge ─────────────────── */

function PlanEntryBadge({
  entry,
}: {
  entry: {
    id: string;
    group_name: string;
    group_color: string;
    trainer_name?: string;
    start_time: string;
    end_time: string;
  };
}) {
  return (
    <div
      className="p-0.5 rounded text-[10px] text-white text-center leading-tight truncate"
      style={{ backgroundColor: entry.group_color || '#7c3aed' }}
      title={`${entry.group_name} · ${entry.start_time}–${entry.end_time}`}
    >
      {entry.group_name}
    </div>
  );
}

/* ─────────────────── Main Component ─────────────────── */

export default function UnifiedCourtCalendar({
  defaultView = 'weekly',
  initialClubId,
}: UnifiedCourtCalendarProps) {
  // ── State ──
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);

  // ── Block dialog state ──
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockCourtId, setBlockCourtId] = useState<string>('');
  const [blockDate, setBlockDate] = useState<Date>(new Date());
  const [blockTimeSlot, setBlockTimeSlot] = useState<string>('');
  const [blockType, setBlockType] = useState<'event' | 'maintenance'>('event');
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockDuration, setBlockDuration] = useState(1); // hours

  // ── User context ──
  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();

  const clubId = clubData?.clubId ?? initialClubId ?? null;
  const memberId = memberData?.memberId ?? null;
  const isAdmin = userRoles.some((r) => r === 'admin' || r === 'superadmin');

  // ── Data fetching ──
  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);
  const { data: seasonPlanData } = useSeasonPlanGrid(activeSeasonId);
  const planSlots = useMemo(() => seasonPlanData?.slots ?? [], [seasonPlanData]);

  // ── Mutations ──
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  // ── DnD sensors (admin only) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Fetch active season ──
  useEffect(() => {
    if (!clubId) return;
    const fetchActiveSeason = async () => {
      try {
        const res = await apiFetch(`/api/seasons?clubId=${clubId}`);
        if (res.ok) {
          const responseData = await res.json();
          const seasons: SeasonInfo[] = responseData.seasons ?? [];
          const active = seasons.find(
            (s) => s.is_active && ['published', 'active'].includes(s.planning_status)
          );
          if (active) {
            setActiveSeasonId(active.id);
          } else {
            const latest = seasons.find((s) =>
              ['published', 'active', 'completed'].includes(s.planning_status)
            );
            if (latest) setActiveSeasonId(latest.id);
          }
        }
      } catch {
        /* ignore */
      }
    };
    fetchActiveSeason();
  }, [clubId]);

  // ── Week calculations ──
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const jsDayToApiDay = (jsDay: number): number => (jsDay === 0 ? 7 : jsDay);

  const goToPrevious = () => {
    if (viewMode === 'weekly') setCurrentWeek(subWeeks(currentWeek, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  };
  const goToNext = () => {
    if (viewMode === 'weekly') setCurrentWeek(addWeeks(currentWeek, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentWeek(today);
    setSelectedDate(today);
  };

  // ── Plan entries helper ──
  const getPlanEntriesForCourtAndDay = useCallback(
    (courtId: string, dayOfWeek: number) => {
      const apiDay = jsDayToApiDay(dayOfWeek);
      return planSlots.filter(
        (slot: { court_id: string; day_of_week: number; [k: string]: unknown }) =>
          slot.court_id === courtId && slot.day_of_week === apiDay
      );
    },
    [planSlots]
  );

  // ── Direct booking (walk-in) ──
  const queryClient = useQueryClient();
  const directBookSlot = useCallback(
    async (courtId: string, date: string, startTime: string, endTime: string) => {
      if (!clubId) return;
      try {
        const res = await apiFetch('/api/bookings/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courtId, date, startTime, endTime, clubId }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? 'Direktbuchung fehlgeschlagen');
          return;
        }
        toast.success('Platz gebucht!');
        // Invalidate sessions to refresh the calendar without a full reload
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } catch {
        toast.error('Netzwerkfehler bei der Direktbuchung');
      }
    },
    [clubId, queryClient]
  );

  // ── Booking actions ──
  const handleBookSlot = useCallback(
    (courtId: string, date: Date, timeSlot: string) => {
      if (!memberId || !clubId) {
        toast.error('Bitte einloggen um zu buchen');
        return;
      }
      const session = getSessionForSlot(courtId, date, timeSlot, sessions);
      if (session) {
        createBooking.mutate({ memberId, sessionId: session.id, clubId });
      } else {
        // Direct booking — create ad-hoc walk-in session + booking
        const dateStr = format(date, 'yyyy-MM-dd');
        const [h, m] = timeSlot.split(':').map(Number);
        const endH = h + 1;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        directBookSlot(courtId, dateStr, timeSlot, endTime);
      }
    },
    [memberId, clubId, sessions, createBooking, directBookSlot]
  );

  const handleCancelBooking = useCallback(
    (sessionId: string, bookingId: string) => {
      if (!clubId) return;
      cancelBooking.mutate({ bookingId, sessionId, clubId });
    },
    [clubId, cancelBooking]
  );

  // ── Slot blocking (admin) ──
  const openBlockDialog = useCallback((courtId: string, date: Date, timeSlot: string) => {
    setBlockCourtId(courtId);
    setBlockDate(date);
    setBlockTimeSlot(timeSlot);
    setBlockType('event');
    setBlockReason('');
    setBlockDuration(1);
    setBlockDialogOpen(true);
  }, []);

  const handleBlockSlot = useCallback(async () => {
    if (!clubId) return;
    const [h, m] = blockTimeSlot.split(':').map(Number);
    if (h + blockDuration > 23) {
      toast.error('Sperrung endet nach 23:00 Uhr — bitte kürzere Dauer wählen');
      return;
    }
    setBlockLoading(true);
    try {
      const dateStr = format(blockDate, 'yyyy-MM-dd');
      const endH = h + blockDuration;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const res = await apiFetch('/api/sessions/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: blockCourtId,
          date: dateStr,
          startTime: blockTimeSlot,
          endTime,
          clubId,
          blockType,
          reason: blockReason || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Sperrung fehlgeschlagen');
        return;
      }
      const blockLabel = blockType === 'event' ? 'Veranstaltung' : 'Wartung';
      toast.success(`${blockLabel}-Sperre gesetzt`);
      setBlockDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch {
      toast.error('Netzwerkfehler beim Sperren');
    } finally {
      setBlockLoading(false);
    }
  }, [
    clubId,
    blockCourtId,
    blockDate,
    blockTimeSlot,
    blockType,
    blockReason,
    blockDuration,
    queryClient,
  ]);

  const handleUnblockSlot = useCallback(
    async (sessionId: string) => {
      const confirmed = window.confirm('Sperrung aufheben? Der Platz wird wieder freigegeben.');
      if (!confirmed) return;
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? 'Sperrung konnte nicht aufgehoben werden');
          return;
        }
        toast.success('Sperrung aufgehoben');
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } catch {
        toast.error('Netzwerkfehler beim Entsperren');
      }
    },
    [queryClient]
  );

  // ── Drag & Drop (admin) ──
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
      const [targetCourtId, targetDateStr, targetTimeSlot] = targetId.split('-');
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

      // Calculate new end time preserving duration
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
          throw new Error(err.error || 'Update failed');
        }
        toast.success(`Session verschoben nach ${targetTimeSlot}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Fehler beim Verschieben');
      }
    },
    [activeId, sessions]
  );

  // ── Export helpers ──
  const handleExportICS = useCallback(() => {
    try {
      exportSessionsToICS(sessions, courts);
      toast.success('ICS-Export erfolgreich');
    } catch {
      toast.error('ICS-Export fehlgeschlagen');
    }
  }, [sessions, courts]);

  // ── Loading states ──
  if (rolesLoading || courtsLoading || sessionsLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Keine Plätze gefunden</div>
      </div>
    );
  }

  // ── Calendar content ──
  const calendarContent = (
    <>
      {viewMode === 'weekly' ? (
        /* ═══════════ WEEKLY VIEW ═══════════ */
        <CourtCalendarGrid>
          <WeekDaysHeaderRow weekDays={weekDays} />

          {courts.map((court) => (
            <div key={court.id} className="border-b border-border last:border-b-0">
              <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-muted">
                <CourtRowHeader court={court} />
                {weekDays.map((day) => {
                  const planEntriesForDay = getPlanEntriesForCourtAndDay(
                    court.id,
                    dateFnsGetDay(day)
                  );

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-1 min-h-[300px] bg-background ${
                        isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Season plan entries — always visible */}
                      {planEntriesForDay.length > 0 && (
                        <div className="space-y-0.5 mb-1">
                          {planEntriesForDay.map(
                            (entry: {
                              id: string;
                              group_id: string | null;
                              group_name: string;
                              group_color: string;
                              trainer_id: string;
                              start_time: string;
                              end_time: string;
                              court_id: string | null;
                              [k: string]: unknown;
                            }) => (
                              <PlanEntryBadge key={entry.id} entry={entry} />
                            )
                          )}
                        </div>
                      )}

                      {/* Time slots */}
                      <div className="space-y-0.5">
                        {TIME_SLOTS.map((timeSlot) => {
                          const { status, session } = getSlotStatus(
                            court.id,
                            day,
                            timeSlot,
                            sessions,
                            planEntriesForDay
                          );
                          const dropTargetId = `${court.id}-${day.toISOString()}-${timeSlot}`;

                          return (
                            <div
                              key={timeSlot}
                              id={isAdmin ? dropTargetId : undefined}
                              className={`h-6 rounded text-[11px] flex items-center justify-center transition-colors ${
                                status === 'blocked' && isAdmin
                                  ? 'bg-muted text-muted-foreground border border-border cursor-pointer hover:bg-muted/80'
                                  : SLOT_STATUS_STYLES[status]
                              }`}
                              role={
                                !isAdmin && status === 'available'
                                  ? 'button'
                                  : isAdmin && (status === 'available' || status === 'blocked')
                                    ? 'button'
                                    : undefined
                              }
                              tabIndex={
                                (!isAdmin && status === 'available') ||
                                (isAdmin && (status === 'available' || status === 'blocked'))
                                  ? 0
                                  : -1
                              }
                              onClick={
                                !isAdmin && status === 'available'
                                  ? () => handleBookSlot(court.id, day, timeSlot)
                                  : isAdmin && status === 'available'
                                    ? () => openBlockDialog(court.id, day, timeSlot)
                                    : isAdmin && status === 'blocked' && session
                                      ? () => handleUnblockSlot(session.id)
                                      : undefined
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (!isAdmin && status === 'available') {
                                    handleBookSlot(court.id, day, timeSlot);
                                  } else if (isAdmin && status === 'available') {
                                    openBlockDialog(court.id, day, timeSlot);
                                  } else if (isAdmin && status === 'blocked' && session) {
                                    handleUnblockSlot(session.id);
                                  }
                                }
                              }}
                            >
                              {status === 'blocked' && session ? (
                                isAdmin ? (
                                  <div className="flex items-center gap-1 w-full justify-between px-1">
                                    <div className="flex items-center gap-0.5">
                                      {session.sessionType === 'maintenance' ? (
                                        <Wrench className="h-2.5 w-2.5 text-muted-foreground" />
                                      ) : (
                                        <PartyPopper className="h-2.5 w-2.5 text-muted-foreground" />
                                      )}
                                      <span className="truncate text-[10px]">
                                        {session.notes?.substring(0, 10) ||
                                          (session.sessionType === 'maintenance'
                                            ? 'Wartung'
                                            : 'Event')}
                                      </span>
                                    </div>
                                    <Unlock className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-0.5 px-1">
                                    <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="text-[10px]">Gesperrt</span>
                                  </div>
                                )
                              ) : session ? (
                                isAdmin ? (
                                  <DraggableSessionCard
                                    session={session}
                                    isDragging={activeId === session.id}
                                  />
                                ) : session.bookedByUser ? (
                                  /* Current user's booking — red with cancel button */
                                  <div className="flex items-center gap-0.5 w-full justify-between px-0.5">
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                      <span className="text-[10px] font-medium truncate text-red-700">
                                        Gebucht
                                      </span>
                                    </div>
                                    {session.bookingId && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCancelBooking(session.id, session.bookingId!);
                                        }}
                                        className="p-0.5 rounded hover:bg-red-100 text-red-600 flex-shrink-0"
                                        title="Buchung stornieren"
                                      >
                                        <svg
                                          className="h-2.5 w-2.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ) : session.hasActiveBooking ? (
                                  /* Someone else booked — orange belegt badge */
                                  <div className="flex items-center gap-0.5 px-0.5">
                                    <Lock className="h-2.5 w-2.5 text-orange-600 flex-shrink-0" />
                                    <span className="text-[10px] truncate text-orange-700">
                                      {timeSlot} Belegt
                                    </span>
                                  </div>
                                ) : (
                                  /* Open session — bookable */
                                  <div className="flex items-center gap-1 w-full justify-between px-1">
                                    <span className="truncate">
                                      {session.trainerName?.substring(0, 8) || 'Trainer'}
                                    </span>
                                  </div>
                                )
                              ) : status === 'plan' ? (
                                <span className="text-[10px] truncate px-0.5">Gruppen</span>
                              ) : (
                                <span className="text-[11px]">{timeSlot}</span>
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
      ) : (
        /* ═══════════ DAILY VIEW ═══════════ */
        <div className="space-y-4">
          {courts.map((court) => {
            const planEntriesForDay = getPlanEntriesForCourtAndDay(
              court.id,
              dateFnsGetDay(selectedDate)
            );

            return (
              <div key={court.id} className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{court.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{getSurfaceLabel(court.surface)}</span>
                        {court.hasIndoor && <span>• Indoor</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plan entries at top */}
                {planEntriesForDay.length > 0 && (
                  <div className="px-4 py-2 bg-purple-50/50 border-b space-y-1">
                    {planEntriesForDay.map(
                      (entry: {
                        id: string;
                        group_id: string | null;
                        group_name: string;
                        group_color: string;
                        trainer_id: string;
                        start_time: string;
                        end_time: string;
                        court_id: string | null;
                        [k: string]: unknown;
                      }) => (
                        <div key={entry.id} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entry.group_color || '#7c3aed' }}
                          />
                          <span className="font-medium">{entry.group_name}</span>
                          <span className="text-muted-foreground">
                            {entry.start_time}–{entry.end_time}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="divide-y">
                  {TIME_SLOTS.map((timeSlot) => {
                    const { status, session } = getSlotStatus(
                      court.id,
                      selectedDate,
                      timeSlot,
                      sessions,
                      planEntriesForDay
                    );

                    return (
                      <div
                        key={timeSlot}
                        className={`p-4 flex items-center justify-between transition-colors ${
                          !isAdmin && status === 'available'
                            ? 'hover:bg-muted cursor-pointer'
                            : isAdmin && status === 'available'
                              ? 'hover:bg-green-50 cursor-pointer'
                              : ''
                        }`}
                        role={status === 'available' ? 'button' : undefined}
                        tabIndex={status === 'available' ? 0 : -1}
                        onClick={
                          !isAdmin && status === 'available'
                            ? () => handleBookSlot(court.id, selectedDate, timeSlot)
                            : isAdmin && status === 'available'
                              ? () => openBlockDialog(court.id, selectedDate, timeSlot)
                              : undefined
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!isAdmin && status === 'available') {
                              handleBookSlot(court.id, selectedDate, timeSlot);
                            } else if (isAdmin && status === 'available') {
                              openBlockDialog(court.id, selectedDate, timeSlot);
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-4 w-full">
                          <div className="w-16 text-center flex-shrink-0">
                            <div className="font-medium text-sm">{timeSlot}</div>
                          </div>

                          {session && status === 'blocked' ? (
                            <div className="flex-1">
                              <div
                                className={`p-3 rounded-lg border ${
                                  isAdmin ? 'cursor-pointer hover:bg-muted' : ''
                                } bg-muted border-border`}
                                onClick={
                                  isAdmin
                                    ? (e) => {
                                        e.stopPropagation();
                                        handleUnblockSlot(session.id);
                                      }
                                    : undefined
                                }
                                role={isAdmin ? 'button' : undefined}
                                tabIndex={isAdmin ? 0 : -1}
                                onKeyDown={
                                  isAdmin
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleUnblockSlot(session.id);
                                        }
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {session.sessionType === 'maintenance' ? (
                                        <Wrench className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <PartyPopper className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="font-medium text-muted-foreground">
                                        {session.notes ||
                                          (session.sessionType === 'maintenance'
                                            ? 'Wartung'
                                            : 'Veranstaltung')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {session.startTime} - {session.endTime}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                      <Unlock className="h-4 w-4" />
                                      <span>Entsperren</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : session ? (
                            <div className="flex-1">
                              <div
                                className={`p-3 rounded-lg border ${
                                  session.bookedByUser
                                    ? 'bg-red-50 border-red-200'
                                    : session.hasActiveBooking
                                      ? 'bg-orange-50 border-orange-200'
                                      : 'bg-blue-50 border-blue-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {session.bookedByUser ? (
                                        <>
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="font-medium text-red-700">
                                            Deine Buchung
                                          </span>
                                        </>
                                      ) : session.hasActiveBooking ? (
                                        <>
                                          <Lock className="h-4 w-4 text-orange-600" />
                                          <span className="font-medium text-orange-700">
                                            Belegt
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <User className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-medium">
                                            {session.trainerName || 'Trainer'}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {session.startTime} - {session.endTime}
                                        </span>
                                      </div>
                                      <span>Max. {session.maxParticipants} TN</span>
                                      {session.hasActiveBooking && !session.bookedByUser && (
                                        <span className="text-orange-600">
                                          • {session.trainerName || 'Trainer'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {session.bookedByUser && session.bookingId && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelBooking(session.id, session.bookingId!);
                                      }}
                                      className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                                      title="Stornieren"
                                    >
                                      <svg
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : status === 'plan' ? (
                            <div className="flex-1">
                              <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                                <span className="text-sm text-purple-700">
                                  Gruppentraining (Saisonplan)
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <div className="p-3 rounded-lg border border-dashed border-green-200 bg-green-50/50">
                                <div className="flex items-center gap-2 text-green-700">
                                  <div className="w-2 h-2 rounded-full bg-green-500" />
                                  <span className="text-sm">Verfügbar — Klicken zum Buchen</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Render ──
  const content = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CourtCalendarHeader
        title="Platz-Kalender"
        subtitle={
          viewMode === 'weekly'
            ? 'Wochenansicht der Platzverfügbarkeit'
            : viewMode === 'list'
              ? 'Buchungsübersicht — Alle Buchungen auf einen Blick'
              : `Tagesansicht · ${format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}`
        }
        weekStart={weekStart}
        weekEnd={weekEnd}
        onGoPrevious={goToPrevious}
        onGoNext={goToNext}
        onGoToday={goToToday}
      >
        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <Button
            variant={viewMode === 'weekly' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setViewMode('weekly')}
          >
            <CalendarIcon className="h-4 w-4 mr-1.5" />
            Woche
          </Button>
          <Button
            variant={viewMode === 'daily' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none border-x border-border"
            onClick={() => setViewMode('daily')}
          >
            <CalendarIcon className="h-4 w-4 mr-1.5" />
            Tag
          </Button>
          {isAdmin && (
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1.5" />
              Liste
            </Button>
          )}
        </div>

        {viewMode === 'daily' && (
          <>
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Export (all roles) */}
        <Button variant="outline" size="sm" onClick={handleExportICS}>
          <Download className="h-4 w-4 mr-2" />
          ICS
        </Button>

        {/* Admin: block slot — click a slot in the calendar first, or use this button with defaults */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const d = viewMode === 'daily' ? selectedDate : new Date();
              openBlockDialog(courts[0]?.id ?? '', d, '10:00');
            }}
          >
            <Lock className="h-4 w-4" />
            Sperren
          </Button>
        )}
      </CourtCalendarHeader>

      {viewMode === 'list' && isAdmin ? (
        <CourtBookingsList clubId={clubId!} isAdmin={isAdmin} />
      ) : (
        <>
          {calendarContent}
          <CourtCalendarLegend items={getLegendItems(isAdmin)} />
        </>
      )}
    </div>
  );

  // ── Block Slot Dialog ──
  const blockDialog = (
    <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Platz sperren
          </DialogTitle>
          <DialogDescription>
            Sperrt den Platz {blockCourtId && courts.find((c) => c.id === blockCourtId)?.name} am{' '}
            {format(blockDate, 'dd.MM.yyyy', { locale: de })} um {blockTimeSlot} Uhr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="block-type">Sperrtyp</Label>
            <div className="flex gap-2">
              <Button
                variant={blockType === 'event' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBlockType('event')}
                className="gap-1.5"
              >
                <PartyPopper className="h-4 w-4" />
                Veranstaltung
              </Button>
              <Button
                variant={blockType === 'maintenance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBlockType('maintenance')}
                className="gap-1.5"
              >
                <Wrench className="h-4 w-4" />
                Wartung
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-duration">Dauer (Stunden)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((h) => (
                <Button
                  key={h}
                  variant={blockDuration === h ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBlockDuration(h)}
                >
                  {h}h
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-reason">Grund (optional)</Label>
            <Input
              id="block-reason"
              placeholder={
                blockType === 'event' ? 'z.B. Firmenevent, Turnier...' : 'z.B. Platzreparatur...'
              }
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleBlockSlot} disabled={blockLoading}>
            {blockLoading ? 'Sperre wird gesetzt...' : 'Platz sperren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Wrap with DndContext for admins
  if (isAdmin) {
    return (
      <>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {content}
          <DragOverlay>
            {activeId && draggedSession ? (
              <DraggableSessionCard session={draggedSession} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
        {blockDialog}
      </>
    );
  }

  return (
    <>
      {content}
      {blockDialog}
    </>
  );
}
