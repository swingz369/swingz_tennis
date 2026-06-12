'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
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
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CourtBookingsList from '@/components/court-bookings-list';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CenteredModal } from '@/components/ui/centered-modal';
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
import { useMemberGroupIds } from '@/hooks/use-member-groups';
import { exportSessionsToICS } from '@/lib/calendar-export';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  getSurfaceLabel,
  getSessionForSlot,
  getSlotStatus,
  SLOT_STATUS_STYLES,
  SLOT_STATUS_STYLES_ADMIN_BLOCKED,
  DAILY_BLOCK_STYLES,
  getCalendarLegendItems,
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

interface PlanEntry {
  id: string;
  group_id: string | null;
  group_name: string;
  group_color: string;
  trainer_id: string;
  trainer_name?: string;
  court_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  [k: string]: unknown;
}

/* ─────────────────── Constants ─────────────────── */

/** Hours shown in the daily view time axis */
const DAILY_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

/** Pixels per hour in the daily time-axis grid */
const PX_PER_HOUR = 64;

/** Breakpoint width (px) below which we force the daily view */
const MOBILE_BREAKPOINT = 768;

/* ─────────────────── Legend items ─────────────────── */

/* ─────────────────── Helpers ─────────────────── */

/** Convert "HH:MM" → minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Parse a session's start/end times to minutes from the grid start */
function getBlockPosition(
  startTime: string,
  endTime: string,
  gridStartHour: number
): { topPx: number; heightPx: number } {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const gridStartMin = gridStartHour * 60;
  const topPx = ((startMin - gridStartMin) / 60) * PX_PER_HOUR;
  const heightPx = Math.max(((endMin - startMin) / 60) * PX_PER_HOUR, 24);
  return { topPx, heightPx };
}

/* ─────────────────── Draggable Session (Admin) ─────────────────── */

function DraggableSessionCard({ session, isDragging }: { session: Session; isDragging?: boolean }) {
  return (
    <div
      className={`px-2.5 py-2 rounded-lg text-xs transition-all duration-150 ${
        isDragging
          ? 'opacity-40 rotate-1 scale-105 shadow-xl bg-blue-100'
          : 'bg-gradient-to-b from-blue-50 to-blue-100/80 text-blue-800 hover:shadow-md border-l-[3px] border-blue-500 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3 w-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <span className="font-bold truncate text-[11px]">{session.trainerName || 'Trainer'}</span>
        {session.bookedByUser && <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-blue-600/80">
        <span className="flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {session.startTime}–{session.endTime}
        </span>
        {session.maxParticipants > 0 && (
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {session.maxParticipants}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Plan Entry Badge (Weekly) ─────────────────── */

function PlanEntryBadge({ entry }: { entry: PlanEntry }) {
  return (
    <div
      className="px-2 py-1 rounded-lg text-white text-[10px] leading-tight shadow-sm border border-white/20"
      style={{ backgroundColor: entry.group_color || '#7c3aed' }}
      title={`${entry.group_name} · ${entry.trainer_name || ''} · ${entry.start_time}–${entry.end_time}`}
    >
      <div className="font-bold truncate">{entry.group_name}</div>
      <div className="flex items-center gap-1 opacity-90 mt-0.5">
        <Clock className="h-2 w-2 flex-shrink-0" />
        <span>
          {entry.start_time}–{entry.end_time}
        </span>
      </div>
      {entry.trainer_name && (
        <div className="flex items-center gap-1 opacity-80 mt-0.5">
          <User className="h-2 w-2 flex-shrink-0" />
          <span className="truncate">{entry.trainer_name}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Positioned Block (Daily View) ─────────────────── */

function PositionedSessionBlock({
  session,
  topPx,
  heightPx,
  isAdmin,
  onBook,
  onBlock,
  onUnblock,
  onCancel,
}: {
  session: Session;
  topPx: number;
  heightPx: number;
  isAdmin: boolean;
  onBook: () => void;
  onBlock: () => void;
  onUnblock: (sessionId: string) => void;
  onCancel: (sessionId: string, bookingId: string) => void;
}) {
  // Make admin session blocks draggable (click still works — PointerSensor requires 8px movement)
  // useDraggable is always called (hooks rule) but attrs/listeners are only spread for admins.
  const {
    attributes: dragAttrs,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: session.id });
  const isBlocked = session.sessionType === 'event' || session.sessionType === 'maintenance';
  const isOwnBooking = session.bookedByUser;
  const isBooked = session.hasActiveBooking && !isOwnBooking;
  const isOpen = !isBlocked && !isOwnBooking && !isBooked;

  const statusKey = isBlocked
    ? 'blocked'
    : isOwnBooking
      ? 'own-booking'
      : isBooked
        ? 'booked'
        : 'session';
  const { bg: bgColor, accent: accentColor, text: textColor } = DAILY_BLOCK_STYLES[statusKey];

  let label = session.trainerName || 'Offene Session';
  let icon = <User className="h-3.5 w-3.5" />;

  if (isBlocked) {
    label = session.notes || (session.sessionType === 'maintenance' ? 'Wartung' : 'Veranstaltung');
    icon =
      session.sessionType === 'maintenance' ? (
        <Wrench className="h-3.5 w-3.5" />
      ) : (
        <PartyPopper className="h-3.5 w-3.5" />
      );
  } else if (isOwnBooking) {
    label = 'Deine Buchung';
    icon = <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />;
  } else if (isBooked) {
    const bookerInfo = session.bookerNames?.length ? session.bookerNames.join(', ') : 'Mitglied';
    label = `Belegt: ${bookerInfo}`;
    icon = (
      <div className="flex-shrink-0 relative">
        <Lock className="h-3.5 w-3.5 text-amber-700" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      </div>
    );
  }

  const isClickable = (!isAdmin && isOpen) || (isAdmin && (isOpen || isBlocked));

  return (
    <div
      ref={isAdmin ? setDragRef : undefined}
      {...(isAdmin ? { ...dragAttrs, ...dragListeners } : {})}
      title={
        isBooked && session.bookerNames?.length
          ? `Gebucht von: ${session.bookerNames.join(', ')}`
          : undefined
      }
      className={`absolute left-0.5 right-0.5 rounded-lg border-l-[3px] ${accentColor} ${bgColor} ${textColor} px-2 py-1.5 overflow-hidden transition-all duration-150 group/block z-10 ${
        isDragging
          ? 'opacity-30 scale-95 shadow-none pointer-events-none'
          : 'cursor-pointer hover:shadow-md'
      }`}
      style={{ top: `${topPx}px`, height: `${heightPx}px` }}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      onClick={() => {
        if (!isAdmin && isOpen) onBook();
        else if (isAdmin && isOpen) onBlock();
        else if (isAdmin && isBlocked) onUnblock(session.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isAdmin && isOpen) onBook();
          else if (isAdmin && isOpen) onBlock();
          else if (isAdmin && isBlocked) onUnblock(session.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isAdmin && !isBlocked && (
            <GripVertical className="h-3 w-3 text-current opacity-0 group-hover/block:opacity-60 transition-opacity flex-shrink-0 -ml-0.5" />
          )}
          {icon}
          <span className="font-bold text-[11px] truncate">{label}</span>
        </div>
        {isAdmin && isBlocked && (
          <Unlock className="h-3 w-3 text-zinc-400 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0" />
        )}
        {isOwnBooking && session.bookingId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(session.id, session.bookingId!);
            }}
            className="p-0.5 rounded hover:bg-rose-200 text-rose-500 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0"
            title="Stornieren"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      {heightPx >= 24 && (
        <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-90">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {session.startTime}–{session.endTime}
          </span>
          {heightPx >= 36 && !isBlocked && session.maxParticipants > 0 && (
            <span className="flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              Max. {session.maxParticipants}
            </span>
          )}
          {isBooked && session.bookerNames && session.bookerNames.length > 0 && heightPx >= 48 && (
            <span className="flex items-center gap-0.5 truncate">
              <User className="h-2.5 w-2.5" />
              <span className="truncate">{session.bookerNames[0]}</span>
              {session.bookerNames.length > 1 && (
                <span className="opacity-70">+{session.bookerNames.length - 1}</span>
              )}
            </span>
          )}
        </div>
      )}
      {/* Booking count badge */}
      {isBooked && session.currentBookings && session.currentBookings > 0 && (
        <div className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-600 text-white text-[9px] font-bold shadow-sm">
          {session.currentBookings}
        </div>
      )}
    </div>
  );
}

function PositionedPlanBlock({
  entry,
  topPx,
  heightPx,
}: {
  entry: PlanEntry;
  topPx: number;
  heightPx: number;
}) {
  return (
    <div
      className="absolute left-0.5 right-0.5 rounded-lg text-white px-2 py-1.5 overflow-hidden shadow-sm border border-white/20 z-[5]"
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        backgroundColor: entry.group_color || '#7c3aed',
      }}
      title={`${entry.group_name} · ${entry.trainer_name || ''} · ${entry.start_time}–${entry.end_time}`}
    >
      <div className="font-bold text-[11px] truncate">{entry.group_name}</div>
      {heightPx >= 24 && (
        <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-90">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {entry.start_time}–{entry.end_time}
          </span>
          {heightPx >= 36 && entry.trainer_name && (
            <span className="flex items-center gap-0.5 truncate">
              <User className="h-2.5 w-2.5" />
              {entry.trainer_name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Droppable Time Slot Wrapper (Weekly View DnD) ─────────────────── */

function DroppableSlot({
  id,
  isAdmin,
  children,
}: {
  id: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  // Hooks must be called unconditionally; useDroppable id is ignored when not needed.
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={isAdmin ? setNodeRef : undefined}
      id={isAdmin ? id : undefined}
      className={isOver && isAdmin ? 'ring-2 ring-inset ring-primary/30 rounded-md' : undefined}
    >
      {children}
    </div>
  );
}

/* ─────────────────── Droppable Hour Zone (Daily View DnD) ─────────────────── */

function DroppableHourZone({
  id,
  topPx,
  draggedSession,
}: {
  id: string;
  topPx: number;
  draggedSession?: Session | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 pointer-events-auto transition-colors duration-150 ${
        isOver ? 'bg-primary/[0.08] rounded-md ring-2 ring-inset ring-primary/20' : ''
      }`}
      style={{ top: `${topPx}px`, height: `${PX_PER_HOUR}px` }}
    >
      {isOver && draggedSession && (
        <div className="absolute inset-x-1 inset-y-0.5 rounded-md border-2 border-dashed border-primary/40 bg-primary/[0.06] flex items-center justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary/70">
            <Clock className="h-3 w-3" />
            <span className="truncate">{draggedSession.trainerName || 'Session'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Mobile Detection Hook ─────────────────── */

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
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
  const [mobileSelectedDay, setMobileSelectedDay] = useState(new Date());
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // ── Block dialog state ──
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockCourtId, setBlockCourtId] = useState<string>('');
  const [blockDate, setBlockDate] = useState<Date>(new Date());
  const [blockTimeSlot, setBlockTimeSlot] = useState<string>('');
  const [blockType, setBlockType] = useState<'event' | 'maintenance'>('event');
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockDuration, setBlockDuration] = useState(1);

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
  const planSlots: PlanEntry[] = useMemo(() => seasonPlanData?.slots ?? [], [seasonPlanData]);

  // ── Member group filtering (role-based view) ──
  const { data: memberGroupIds = [] } = useMemberGroupIds(clubId);

  /** Sessions visible to the current user. Admin sees all; member sees group sessions + own bookings. */
  const visibleSessions = useMemo(() => {
    if (isAdmin) return sessions;
    if (memberGroupIds.length === 0) {
      // No group memberships → only show own bookings + open sessions (no groupIds)
      return sessions.filter(
        (s: Session) => s.bookedByUser || !s.groupIds || s.groupIds.length === 0
      );
    }
    const groupSet = new Set(memberGroupIds);
    return sessions.filter((s: Session) => {
      // Always show own bookings
      if (s.bookedByUser) return true;
      // Show sessions with no groups assigned (open sessions)
      if (!s.groupIds || s.groupIds.length === 0) return true;
      // Show sessions that overlap with the member's groups
      return s.groupIds.some((gid: string) => groupSet.has(gid));
    });
  }, [sessions, isAdmin, memberGroupIds]);

  /** Plan entries visible to the current user. Admin sees all; member sees only their groups. */
  const visiblePlanSlots = useMemo(() => {
    if (isAdmin) return planSlots;
    if (memberGroupIds.length === 0) return []; // No groups → no plan entries visible
    const groupSet = new Set(memberGroupIds);
    return planSlots.filter((e: PlanEntry) => e.group_id && groupSet.has(e.group_id));
  }, [planSlots, isAdmin, memberGroupIds]);

  // ── Court selection: derive effective court ID ──
  // If courts loaded but selected court no longer exists, fall back to card view
  const selectedCourt = selectedCourtId ? courts.find((c) => c.id === selectedCourtId) : null;
  const effectiveCourtId =
    selectedCourtId && courts.length > 0 && !selectedCourt ? null : selectedCourtId;

  // ── Mutations ──
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  // ── DnD sensors (admin only) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Touch swipe ref (mobile day-pill navigation) ──
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipeContainerRef = useRef<HTMLDivElement>(null);

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

  // ── Sync mobile selected day when week changes ──
  useEffect(() => {
    if (isMobile && viewMode === 'weekly') {
      const weekMonday = startOfWeek(currentWeek, { weekStartsOn: 1 });
      // Preserve day-of-week offset so navigating weeks keeps the same weekday
      const dayOffset = Math.min(
        mobileSelectedDay.getDay() === 0 ? 6 : mobileSelectedDay.getDay() - 1,
        6
      );
      setMobileSelectedDay(addDays(weekMonday, dayOffset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, isMobile, viewMode]);

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
    setMobileSelectedDay(today);
  };

  // ── Plan entries helper (uses visible plan slots for role-based filtering) ──
  const getPlanEntriesForCourtAndDay = useCallback(
    (courtId: string, dayOfWeek: number) => {
      const apiDay = jsDayToApiDay(dayOfWeek);
      return visiblePlanSlots.filter(
        (slot) => slot.court_id === courtId && slot.day_of_week === apiDay
      );
    },
    [visiblePlanSlots]
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
        const res = await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
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
      const exportCourts = effectiveCourtId
        ? courts.filter((c) => c.id === effectiveCourtId)
        : courts;
      exportSessionsToICS(visibleSessions, exportCourts);
      toast.success('ICS-Export erfolgreich');
    } catch {
      toast.error('ICS-Export fehlgeschlagen');
    }
  }, [visibleSessions, courts, effectiveCourtId]);

  /* ═══════════════════════════════════════════════════
     RENDER: Loading & Empty
     ═══════════════════════════════════════════════════ */

  if (rolesLoading || courtsLoading || sessionsLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="grid grid-cols-8 bg-muted/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-muted/40 animate-pulse border-r border-border/20 last:border-r-0"
              />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, row) => (
            <div key={row} className="grid grid-cols-8 border-t border-border/20">
              {Array.from({ length: 8 }).map((_, col) => (
                <div
                  key={col}
                  className="h-40 bg-background border-r border-border/20 last:border-r-0 p-1.5"
                >
                  <div className="space-y-1">
                    {Array.from({ length: 4 }).map((_, s) => (
                      <div key={s} className="h-5 bg-muted/30 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-lg font-medium">Keine Plätze gefunden</p>
          <p className="text-sm">Fügen Sie über die Verwaltung Plätze hinzu.</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     Court Selection Cards (Admin + Member)
     Shown when no court is selected. Click a court to see its schedule.
     ═══════════════════════════════════════════════════ */

  if (!effectiveCourtId) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Platz-Kalender</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? 'Wähle einen Platz, um den Stundenplan zu verwalten'
              : 'Wähle einen Platz, um die Verfügbarkeit zu sehen und zu buchen'}
          </p>
        </div>

        {/* Warning when no future sessions exist */}
        {visibleSessions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Keine zukünftigen Sessions gefunden
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Es sind aktuell keine Trainings-Sessions für die Zukunft geplant.{' '}
                  {isAdmin && (
                    <>
                      Bitte den{' '}
                      <Link
                        href="/admin/seasons"
                        className="font-semibold text-amber-800 underline hover:text-amber-900 transition-colors"
                      >
                        Saisonplan
                      </Link>{' '}
                      veröffentlichen, damit Sessions erstellt werden.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courts.map((court) => {
            // Count sessions for today on this court
            const todaySessions = visibleSessions.filter((s: Session) => {
              if (s.courtId !== court.id || !s.timeslotStart) return false;
              return isSameDay(new Date(s.timeslotStart), new Date());
            });
            const bookedCount = todaySessions.filter(
              (s: Session) => s.hasActiveBooking || s.bookedByUser
            ).length;
            const totalToday = todaySessions.length;

            return (
              <button
                key={court.id}
                onClick={() => {
                  setSelectedCourtId(court.id);
                  setViewMode('daily');
                }}
                className="group relative flex flex-col text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              >
                {/* Court icon */}
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3 group-hover:bg-primary/20 transition-colors">
                  <MapPin className="h-6 w-6" />
                </div>

                {/* Name */}
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {court.name}
                </h3>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground border border-border/50">
                    {getSurfaceLabel(court.surface)}
                  </span>
                  {court.hasIndoor && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-semibold text-blue-600 border border-blue-100">
                      Indoor
                    </span>
                  )}
                  {court.hasLighting && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-[10px] font-semibold text-amber-700 border border-amber-100">
                      Flutlicht
                    </span>
                  )}
                </div>

                {/* Today's availability */}
                <div className="mt-4 pt-3 border-t border-border/40">
                  {totalToday > 0 ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${bookedCount === totalToday ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {totalToday - bookedCount} von {totalToday} Slots frei
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-300" />
                      <span className="text-xs text-muted-foreground">Heute keine Sessions</span>
                    </div>
                  )}
                </div>

                {/* Arrow indicator */}
                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-5 w-5 text-primary" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <CourtCalendarLegend items={getCalendarLegendItems(false)} />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Weekly View
     ═══════════════════════════════════════════════════ */

  // ── Court filtering: single-court mode for members ──
  const displayCourts = effectiveCourtId ? courts.filter((c) => c.id === effectiveCourtId) : courts;
  /* Mobile: show day-pills + daily view when in weekly mode */
  const mobileWeekView = isMobile && viewMode === 'weekly';

  // ── Touch swipe handler for mobile day navigation ──
  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleSwipeTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    // Show dampened visual offset for primarily horizontal movement (ref-based to avoid re-renders)
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && swipeContainerRef.current) {
      swipeContainerRef.current.style.transform = `translateX(${deltaX * 0.3}px)`;
      swipeContainerRef.current.style.transition = 'none';
    }
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    // Snap back with animation
    if (swipeContainerRef.current) {
      swipeContainerRef.current.style.transform = 'translateX(0px)';
      swipeContainerRef.current.style.transition = 'transform 0.2s ease-out';
    }
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Only trigger on horizontal swipes (|dx| > 40px and |dx| > 1.2× |dy|)
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    const currentDay = mobileSelectedDay;
    if (deltaX < 0) {
      // Swipe left → next day
      const nextDay = addDays(currentDay, 1);
      if (nextDay > weekEnd) setCurrentWeek(addWeeks(currentWeek, 1));
      setMobileSelectedDay(nextDay);
    } else {
      // Swipe right → previous day
      const prevDay = subDays(currentDay, 1);
      if (prevDay < weekStart) setCurrentWeek(subWeeks(currentWeek, 1));
      setMobileSelectedDay(prevDay);
    }
  };

  const weeklyView = mobileWeekView ? (
    <div className="space-y-4">
      {/* Horizontal day selector (swipeable) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {weekDays.map((day) => {
          const today = isSameDay(day, new Date());
          const selected = isSameDay(day, mobileSelectedDay);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setMobileSelectedDay(day)}
              className={`flex flex-col items-center min-w-[52px] px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                selected
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : today
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-80">
                {format(day, 'EEE', { locale: de })}
              </span>
              <span className="text-base font-bold mt-0.5 tabular-nums">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Daily view for selected day — swipe left/right to change day */}
      <div
        ref={swipeContainerRef}
        onTouchStart={handleSwipeTouchStart}
        onTouchMove={handleSwipeTouchMove}
        onTouchEnd={handleSwipeTouchEnd}
        style={{ willChange: 'transform' }}
      >
        {renderDailyView(mobileSelectedDay, activeId)}
      </div>
    </div>
  ) : (
    <CourtCalendarGrid>
      <WeekDaysHeaderRow weekDays={weekDays} />

      {displayCourts.map((court) => (
        <div key={court.id} className="border-b border-border/40 last:border-b-0">
          <div className="grid grid-cols-[180px_repeat(7,1fr)]">
            <CourtRowHeader court={court} />
            {weekDays.map((day) => {
              const planEntriesForDay = getPlanEntriesForCourtAndDay(court.id, dateFnsGetDay(day));

              return (
                <div
                  key={day.toISOString()}
                  className={`p-1.5 min-h-[420px] border-r border-border/20 last:border-r-0 ${
                    isSameDay(day, new Date()) ? 'bg-primary/[0.03]' : 'bg-background'
                  }`}
                >
                  {/* Season plan entries */}
                  {planEntriesForDay.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {planEntriesForDay.map((entry) => (
                        <PlanEntryBadge key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}

                  {/* Time slots */}
                  <div className="space-y-0.5">
                    {TIME_SLOTS.map((timeSlot) => {
                      const { status, session } = getSlotStatus(
                        court.id,
                        day,
                        timeSlot,
                        visibleSessions,
                        planEntriesForDay.filter(
                          (e): e is PlanEntry & { court_id: string } => e.court_id !== null
                        )
                      );
                      const dropTargetId = `${court.id}::${day.toISOString()}::${timeSlot}`;

                      return (
                        <DroppableSlot key={timeSlot} id={dropTargetId} isAdmin={isAdmin}>
                          <div
                            className={`group min-h-[44px] rounded-lg text-[11px] flex items-center transition-all duration-150 ${
                              status === 'blocked' && isAdmin
                                ? SLOT_STATUS_STYLES_ADMIN_BLOCKED
                                : SLOT_STATUS_STYLES[status]
                            }`}
                            role="button"
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
                                <div className="flex items-center gap-1 w-full justify-between px-2">
                                  <div className="flex items-center gap-1.5">
                                    {session.sessionType === 'maintenance' ? (
                                      <Wrench className="h-3 w-3 text-zinc-500" />
                                    ) : (
                                      <PartyPopper className="h-3 w-3 text-zinc-500" />
                                    )}
                                    <span className="truncate text-[10px] font-semibold">
                                      {session.notes?.substring(0, 12) ||
                                        (session.sessionType === 'maintenance'
                                          ? 'Wartung'
                                          : 'Event')}
                                    </span>
                                  </div>
                                  <Unlock className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2">
                                  <Lock className="h-3 w-3 text-zinc-400" />
                                  <span className="text-[10px] font-semibold">Gesperrt</span>
                                </div>
                              )
                            ) : session ? (
                              isAdmin ? (
                                <DraggableSessionCard
                                  session={session}
                                  isDragging={activeId === session.id}
                                />
                              ) : session.bookedByUser ? (
                                <div className="flex items-center gap-1 w-full justify-between px-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-bold truncate text-rose-700 block">
                                        Deine Buchung
                                      </span>
                                      <span className="text-[9px] text-rose-500 font-medium">
                                        {session.startTime}–{session.endTime}
                                      </span>
                                    </div>
                                  </div>
                                  {session.bookingId && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelBooking(session.id, session.bookingId!);
                                      }}
                                      className="p-0.5 rounded-md hover:bg-rose-200 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                      title="Buchung stornieren"
                                    >
                                      <svg
                                        className="h-3 w-3"
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 px-2 min-w-0">
                                      <div className="flex-shrink-0 relative">
                                        <Lock className="h-3.5 w-3.5 text-amber-700" />
                                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-bold truncate text-amber-900 block">
                                          Belegt
                                        </span>
                                        <span className="text-[9px] text-amber-700 font-semibold">
                                          {session.startTime}–{session.endTime}
                                        </span>
                                      </div>{' '}
                                      {session.currentBookings && session.currentBookings > 0 && (
                                        <span className="flex-shrink-0 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-600 text-white text-[9px] font-bold">
                                          {session.currentBookings}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p className="font-semibold">Gebucht von:</p>
                                    {session.bookerNames && session.bookerNames.length > 0 ? (
                                      <ul className="mt-0.5 space-y-0.5">
                                        {session.bookerNames.map((name, i) => (
                                          <li key={i} className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {name}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-muted-foreground">Mitglied</p>
                                    )}
                                    <p className="mt-1 text-muted-foreground">
                                      {session.currentBookings} / {session.maxParticipants} Plätze
                                      belegt
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <div className="flex items-center gap-1.5 w-full px-2 min-w-0">
                                  <User className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="truncate text-[10px] font-bold text-blue-800 block">
                                      {session.trainerName?.substring(0, 12) || 'Trainer'}
                                    </span>
                                    <span className="text-[9px] text-blue-500 font-medium">
                                      {session.startTime}–{session.endTime}
                                    </span>
                                  </div>
                                </div>
                              )
                            ) : status === 'plan' ? (
                              <div className="flex items-center gap-1.5 px-2 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                <span className="text-[10px] truncate font-semibold text-violet-700">
                                  Gruppentraining
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] px-2 text-emerald-600/70 font-medium">
                                {timeSlot}
                              </span>
                            )}
                          </div>
                        </DroppableSlot>
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
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Daily View — Google-Calendar-Style Time Axis
     (extracted into a function so mobile week view can reuse it)
     ═══════════════════════════════════════════════════ */

  function renderDailyView(targetDate: Date, activeDragId?: string | null) {
    const gridStartHour = DAILY_HOURS[0];
    const totalHours = DAILY_HOURS.length;
    const gridHeight = totalHours * PX_PER_HOUR;

    // Gather all plan entries for the target day across all courts
    const planEntriesByCourt = new Map<string, PlanEntry[]>();
    for (const court of displayCourts) {
      const entries = getPlanEntriesForCourtAndDay(court.id, dateFnsGetDay(targetDate));
      if (entries.length > 0) planEntriesByCourt.set(court.id, entries);
    }

    // Filter sessions for the target day
    const daySessions = visibleSessions.filter((s: Session) => {
      if (!s.timeslotStart) return false;
      return isSameDay(new Date(s.timeslotStart), targetDate);
    });

    // Resolve dragged session for drop-zone preview
    const dailyDraggedSession = activeDragId
      ? (sessions.find((s: Session) => s.id === activeDragId) ?? null)
      : null;

    /** Time-column width: narrower on mobile */
    const timeColW = isMobile ? '40px' : '56px';
    /** Min-width per court column: 140px on mobile for horizontal scroll, 1fr on desktop */
    const courtColMin = isMobile ? '140px' : '1fr';
    /** Min-width: grows with court count on mobile, 600px on desktop */
    const gridMinW = isMobile
      ? `calc(${timeColW} + ${displayCourts.length} * ${courtColMin})`
      : '600px';

    return (
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Day navigation mini-header — hidden when used inside mobile week pills */}
        {!mobileWeekView && (
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-primary/[0.04] to-transparent border-b border-border/40">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPrevious}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="text-center flex-1 min-w-0">
              <span className={`font-bold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                {format(targetDate, 'EEEE', { locale: de })}
              </span>
              <span
                className={`text-muted-foreground ${isMobile ? 'text-xs ml-1' : 'text-sm ml-2'}`}
              >
                {format(targetDate, isMobile ? 'dd.MM.' : 'dd. MMMM yyyy', { locale: de })}
              </span>
              {isSameDay(targetDate, new Date()) && (
                <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  Heute
                </span>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNext}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Time-axis grid */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: gridMinW }}>
            {/* Court headers */}
            <div
              className="grid border-b border-border/40"
              style={{
                gridTemplateColumns: `${timeColW} repeat(${displayCourts.length}, ${courtColMin})`,
              }}
            >
              <div className="p-1.5 sm:p-2" />
              {displayCourts.map((court) => (
                <div
                  key={court.id}
                  className={`text-center border-l border-border/20 ${isMobile ? 'p-1.5' : 'p-3'}`}
                >
                  <div className={`font-bold text-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {court.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-muted text-[8px] sm:text-[9px] font-medium text-muted-foreground border border-border/50">
                      {getSurfaceLabel(court.surface)}
                    </span>
                    {court.hasIndoor && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-blue-50 text-[8px] sm:text-[9px] font-medium text-blue-600 border border-blue-100">
                        Indoor
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="relative overflow-hidden" style={{ height: `${gridHeight}px` }}>
              {/* Hour rows (background) */}
              {DAILY_HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-border/20"
                  style={{
                    top: `${(hour - gridStartHour) * PX_PER_HOUR}px`,
                    height: `${PX_PER_HOUR}px`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 text-right pr-1 sm:pr-2 -translate-y-2 text-[10px] font-medium text-muted-foreground tabular-nums"
                    style={{ width: timeColW }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                </div>
              ))}

              {/* Court columns with positioned blocks */}
              <div
                className="absolute top-0 bottom-0 grid"
                style={{
                  left: timeColW,
                  right: 0,
                  gridTemplateColumns: `repeat(${displayCourts.length}, ${courtColMin})`,
                }}
              >
                {displayCourts.map((court) => {
                  const courtSessions = daySessions.filter(
                    (session: Session) => session.courtId === court.id
                  );
                  const courtPlanEntries = planEntriesByCourt.get(court.id) ?? [];

                  return (
                    <div key={court.id} className="relative border-l border-border/20">
                      {/* Hour cell separators */}
                      {DAILY_HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-b border-border/10"
                          style={{
                            top: `${(hour - gridStartHour) * PX_PER_HOUR}px`,
                            height: `${PX_PER_HOUR}px`,
                          }}
                        />
                      ))}

                      {/* Plan entry blocks */}
                      {courtPlanEntries.map((entry) => {
                        const pos = getBlockPosition(
                          entry.start_time,
                          entry.end_time,
                          gridStartHour
                        );
                        return (
                          <PositionedPlanBlock
                            key={entry.id}
                            entry={entry}
                            topPx={pos.topPx}
                            heightPx={pos.heightPx}
                          />
                        );
                      })}

                      {/* Droppable hour zones (admin DnD) */}
                      {isAdmin &&
                        DAILY_HOURS.map((hour) => (
                          <DroppableHourZone
                            key={`drop-${court.id}-${hour}`}
                            id={`${court.id}::${targetDate.toISOString()}::${String(hour).padStart(2, '0')}:00`}
                            topPx={(hour - gridStartHour) * PX_PER_HOUR}
                            draggedSession={dailyDraggedSession}
                          />
                        ))}

                      {/* Session blocks */}
                      {courtSessions.map((session: Session) => {
                        if (!session.startTime || !session.endTime) return null;
                        const pos = getBlockPosition(
                          session.startTime,
                          session.endTime,
                          gridStartHour
                        );
                        return (
                          <PositionedSessionBlock
                            key={session.id}
                            session={session}
                            topPx={pos.topPx}
                            heightPx={pos.heightPx}
                            isAdmin={isAdmin}
                            onBook={() => handleBookSlot(court.id, targetDate, session.startTime)}
                            onBlock={() => openBlockDialog(court.id, targetDate, session.startTime)}
                            onUnblock={handleUnblockSlot}
                            onCancel={handleCancelBooking}
                          />
                        );
                      })}

                      {/* Clickable empty area */}
                      <div
                        className="absolute inset-0 z-0"
                        role="button"
                        tabIndex={isAdmin ? 0 : -1}
                        onClick={(e) => {
                          if (isAdmin && e.target === e.currentTarget) {
                            openBlockDialog(court.id, targetDate, '10:00');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (isAdmin && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            openBlockDialog(court.id, targetDate, '10:00');
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Current time indicator line */}
              {isSameDay(targetDate, new Date()) &&
                (() => {
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const gridStartMin = gridStartHour * 60;
                  const topPx = ((nowMin - gridStartMin) / 60) * PX_PER_HOUR;
                  if (topPx < 0 || topPx > gridHeight) return null;
                  return (
                    <div
                      className="absolute right-0 z-20 pointer-events-none"
                      style={{ left: timeColW, top: `${topPx}px` }}
                    >
                      <div className="relative">
                        <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                        <div className="h-0.5 bg-rose-500 shadow-sm" />
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Main Layout
     ═══════════════════════════════════════════════════ */

  const calendarContent = (
    <>
      {viewMode === 'weekly' && weeklyView}
      {viewMode === 'daily' && renderDailyView(selectedDate, activeId)}
    </>
  );

  const content = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Back button to return to court selection cards */}
      {effectiveCourtId && (
        <button
          onClick={() => setSelectedCourtId(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors group/back"
        >
          <ChevronLeft className="h-4 w-4 group-hover/back:-translate-x-0.5 transition-transform" />
          Alle Plätze
        </button>
      )}

      <CourtCalendarHeader
        title={selectedCourt ? selectedCourt.name : 'Platz-Kalender'}
        subtitle={
          selectedCourt
            ? `${getSurfaceLabel(selectedCourt.surface)}${selectedCourt.hasIndoor ? ' · Indoor' : ''} · ${viewMode === 'weekly' ? 'Wochenansicht' : 'Tagesansicht'}`
            : viewMode === 'weekly'
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

        {/* Export (all roles) */}
        <Button variant="outline" size="sm" onClick={handleExportICS}>
          <Download className="h-4 w-4 mr-2" />
          ICS
        </Button>

        {/* Admin: block slot */}
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

      {/* Zero-sessions warning (admin view) */}
      {isAdmin && visibleSessions.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Keine zukünftigen Sessions gefunden
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Es sind aktuell keine Sessions für die Zukunft geplant. Bitte den{' '}
                <Link
                  href="/admin/seasons"
                  className="font-semibold text-amber-800 underline hover:text-amber-900 transition-colors"
                >
                  Saisonplan
                </Link>{' '}
                veröffentlichen, damit Sessions erstellt und Buchungen ermöglicht werden.
              </p>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && isAdmin ? (
        <CourtBookingsList clubId={clubId!} isAdmin={isAdmin} />
      ) : (
        <>
          {calendarContent}
          <CourtCalendarLegend items={getCalendarLegendItems(isAdmin)} />
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Block Dialog
     ═══════════════════════════════════════════════════ */

  const blockDialog = (
    <CenteredModal open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Platz sperren
        </h2>
        <p className="text-sm text-muted-foreground">
          Sperrt den Platz {blockCourtId && courts.find((c) => c.id === blockCourtId)?.name} am{' '}
          {format(blockDate, 'dd.MM.yyyy', { locale: de })} um {blockTimeSlot} Uhr.
        </p>
      </div>

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

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
          Abbrechen
        </Button>
        <Button onClick={handleBlockSlot} disabled={blockLoading}>
          {blockLoading ? 'Sperre wird gesetzt...' : 'Platz sperren'}
        </Button>
      </div>
    </CenteredModal>
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Wrap with DnD for admins
     ═══════════════════════════════════════════════════ */

  // Wrap all content in a single TooltipProvider (avoids per-slot overhead)
  const wrappedContent = isAdmin ? (
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
  ) : (
    <>
      {content}
      {blockDialog}
    </>
  );

  return <TooltipProvider delayDuration={200}>{wrappedContent}</TooltipProvider>;
}
