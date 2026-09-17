'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  parseISO,
  isValid as isValidDate,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameDay,
  getDay as dateFnsGetDay,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
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
  CloudRain,
  Cloud,
  Sun,
  Snowflake,
  Plus,
  X,
  Search,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CourtBookingsList from '@/components/court-bookings-list';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import { useActingAsMemberId } from '@/hooks/use-effective-member';
import { useCourts } from '@/hooks/use-courts';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
  useUpdateBookingStatus,
  type Session,
} from '@/hooks/use-sessions';
import { MonthView } from '@/components/calendar/month-view';
import {
  useTrainerHourSlots,
  useBookTrainerHourSlot,
  useWaitlistTrainerHourSlot,
} from '@/hooks/use-trainer-hour-slots';
import { TrainerHourSlotsSection } from '@/components/calendar/trainer-hour-slots';
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
  type CourtClosure,
} from '@/lib/court-calendar-utils';
import {
  CourtCalendarHeader,
  CourtCalendarGrid,
  WeekDaysHeaderRow,
  CourtRowHeader,
  CourtCalendarLegend,
} from '@/components/court-calendar-shared';
import { apiFetch } from '@/lib/api-fetch';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';
import { SessionCancelDialog } from '@/components/session-cancel-dialog';
import { BlockCourtDialog } from '@/components/block-court-dialog';
import { AdHocSessionDialog } from '@/components/ad-hoc-session-dialog';

/* ─────────────────── Types ─────────────────── */

type ViewMode = 'agenda' | 'weekly' | 'daily' | 'list' | 'month';

const VIEW_MODES: ViewMode[] = ['agenda', 'weekly', 'daily', 'list', 'month'];
function isViewMode(value: string | null): value is ViewMode {
  return !!value && (VIEW_MODES as string[]).includes(value);
}
function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValidDate(parsed) ? parsed : null;
}

interface SeasonInfo {
  id: string;
  is_active: boolean;
  planning_status: string;
}

interface UnifiedCourtCalendarProps {
  /** Override view mode (default: agenda) */
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
const DAILY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

/** Pixels per hour in the daily time-axis grid */
const PX_PER_HOUR = 64;

/** Breakpoint width (px) below which we force the daily view */
const MOBILE_BREAKPOINT = 768;

/** Kurzlabel für court_closures.reason im Grid (Platz ist knapp) */
const REASON_LABEL_SHORT: Record<string, string> = {
  maintenance: 'Wartung',
  event: 'Event',
  tournament: 'Turnier',
  weather: 'Wetter',
  other: 'Sonstiges',
};

/* ─────────────────── Legend items ─────────────────── */

/* ─────────────────── Helpers ─────────────────── */

/**
 * Scannt Plätze × kommende 7 Tage × Stunden-Slots nach dem ersten freien Termin.
 * Als eigenständige Funktion gehalten (statt Logik direkt im useMemo), damit der
 * React Compiler die Memoization sauber ableiten kann.
 */
function findNextFreeSlot(
  courts: { id: string; name: string }[],
  sessions: Session[],
  closures: CourtClosure[],
  getPlanEntries: (courtId: string, dayOfWeek: number) => (PlanEntry & { court_id: string })[],
  openingHours: unknown
): { courtId: string; courtName: string; date: Date; timeSlot: string } | null {
  if (courts.length === 0) return null;
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(now, dayOffset);
    for (const timeSlot of TIME_SLOTS) {
      const [h, m] = timeSlot.split(':').map(Number);
      const slotDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      if (slotDateTime <= now) continue;
      const court = courts.find((c) => {
        const planEntriesForDay = getPlanEntries(c.id, dateFnsGetDay(date));
        const { status } = getSlotStatus(
          c.id,
          date,
          timeSlot,
          sessions,
          planEntriesForDay,
          closures,
          openingHours
        );
        return status === 'available';
      });
      if (court) return { courtId: court.id, courtName: court.name, date, timeSlot };
    }
  }
  return null;
}

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

function DraggableSessionCard({
  session,
  isDragging,
  onCancelSession,
}: {
  session: Session;
  isDragging?: boolean;
  onCancelSession?: (session: Session) => void;
}) {
  const isCancelled = !!session.cancelledAt;
  return (
    <div
      className={`px-2.5 py-2 rounded-xl text-xs transition-all duration-150 group ${
        isCancelled
          ? 'bg-error-50 text-error-700 border-l-[3px] border-error-400 opacity-70'
          : isDragging
            ? 'opacity-40 rotate-1 scale-105 shadow-xl bg-info-100'
            : 'bg-info-50 text-info-800 hover:shadow-md border-l-[3px] border-info-500 cursor-grab active:cursor-grabbing'
      }`}
    >
      {isCancelled && <div className="text-3xs font-semibold text-error-600 mb-0.5">Abgesagt</div>}
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3 w-3 text-info-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <span className="font-bold truncate text-2xs">{session.trainerName || 'Trainer'}</span>
        {session.bookedByUser && (
          <div className="w-2 h-2 rounded-full bg-error-500 flex-shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-2xs text-info-600/80">
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
      {onCancelSession && !isCancelled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancelSession(session);
          }}
          className="mt-1 w-full text-3xs text-error-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline text-left"
          title="Training absagen"
        >
          Training absagen
        </button>
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
  onCancelSession,
}: {
  session: Session;
  topPx: number;
  heightPx: number;
  isAdmin: boolean;
  onBook: () => void;
  onBlock: () => void;
  onUnblock: (sessionId: string) => void;
  onCancel: (sessionId: string, bookingId: string) => void;
  onCancelSession?: (session: Session) => void;
}) {
  // Make admin session blocks draggable (click still works — PointerSensor requires 8px movement)
  // useDraggable is always called (hooks rule) but attrs/listeners are only spread for admins.
  const {
    attributes: dragAttrs,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: session.id });
  const isCancelledSession = !!session.cancelledAt;
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
  const rawStyle = DAILY_BLOCK_STYLES[statusKey];
  const bgColor = isCancelledSession ? 'bg-error-50' : rawStyle.bg;
  const accentColor = isCancelledSession ? 'border-error-400' : rawStyle.accent;
  const textColor = isCancelledSession ? 'text-error-700' : rawStyle.text;

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
    icon = <div className="w-2.5 h-2.5 rounded-full bg-error-500" />;
  } else if (isBooked) {
    const bookerInfo = session.bookerNames?.length ? session.bookerNames.join(', ') : 'Mitglied';
    label = `Belegt: ${bookerInfo}`;
    icon = (
      <div className="flex-shrink-0 relative">
        <Lock className="h-3.5 w-3.5 text-warning-700" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
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
      className={`absolute left-0.5 right-0.5 rounded-xl border-l-[3px] ${accentColor} ${bgColor} ${textColor} px-2 py-1.5 overflow-hidden transition-all duration-150 group/block z-10 ${
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
      {isCancelledSession && (
        <div className="text-3xs font-semibold text-error-600 mb-0.5">Abgesagt</div>
      )}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isAdmin && !isBlocked && !isCancelledSession && (
            <GripVertical className="h-3 w-3 text-current opacity-0 group-hover/block:opacity-60 transition-opacity flex-shrink-0 -ml-0.5" />
          )}
          {icon}
          <span
            className={`font-bold text-2xs truncate${isCancelledSession ? ' line-through opacity-60' : ''}`}
          >
            {label}
          </span>
        </div>
        {isAdmin && isBlocked && (
          <Unlock className="h-3 w-3 text-gray-400 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0" />
        )}
        {isOwnBooking && session.bookingId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(session.id, session.bookingId!);
            }}
            className="p-0.5 rounded hover:bg-error-200 text-error-500 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0"
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
        <div className="flex items-center gap-2 mt-0.5 text-2xs opacity-90">
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
        <div className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning-600 text-white text-3xs font-bold shadow-sm">
          {session.currentBookings}
        </div>
      )}
      {/* Admin: Training-Absage-Button (nur für echte Training-Sessions, nicht für Blocks) */}
      {isAdmin && !isBlocked && !isCancelledSession && onCancelSession && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancelSession(session);
          }}
          className="absolute bottom-1 right-1 text-3xs text-error-500 opacity-0 group-hover/block:opacity-100 transition-opacity hover:underline"
          title="Training absagen"
        >
          Absagen
        </button>
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
      className="absolute left-0.5 right-0.5 rounded-xl text-white px-2 py-1.5 overflow-hidden shadow-sm border border-white/20 z-[5]"
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        backgroundColor: entry.group_color || '#7c3aed',
      }}
      title={`${entry.group_name} · ${entry.trainer_name || ''} · ${entry.start_time}–${entry.end_time}`}
    >
      <div className="font-bold text-2xs truncate">{entry.group_name}</div>
      {heightPx >= 24 && (
        <div className="flex items-center gap-2 mt-0.5 text-2xs opacity-90">
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

/** Tagesansicht-Block für eine court_closures-Sperre (getrennt von PositionedSessionBlock,
 *  da eine Closure keine Session ist). Innerhalb des Tages auf DAILY_HOURS geclippt. */
function PositionedClosureBlock({
  closure,
  topPx,
  heightPx,
  isAdmin,
  onUnblock,
}: {
  closure: CourtClosure;
  topPx: number;
  heightPx: number;
  isAdmin: boolean;
  onUnblock: (closureId: string) => void;
}) {
  const label = closure.description || REASON_LABEL_SHORT[closure.reason] || closure.reason;
  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded-xl border-l-[3px] border-l-gray-400 ${DAILY_BLOCK_STYLES.blocked.bg} ${DAILY_BLOCK_STYLES.blocked.text} px-2 py-1.5 overflow-hidden group/block z-10 ${
        isAdmin ? 'cursor-pointer hover:shadow-md' : ''
      }`}
      style={{ top: `${topPx}px`, height: `${heightPx}px` }}
      role="button"
      tabIndex={isAdmin ? 0 : -1}
      onClick={isAdmin ? () => onUnblock(closure.id) : undefined}
      onKeyDown={
        isAdmin
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onUnblock(closure.id);
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Lock className="h-3.5 w-3.5" />
          <span className="font-bold text-2xs truncate">{isAdmin ? label : 'Gesperrt'}</span>
        </div>
        {isAdmin && (
          <Unlock className="h-3 w-3 text-gray-400 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
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
          <div className="flex items-center gap-1.5 text-2xs font-semibold text-primary/70">
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
  defaultView,
  initialClubId,
}: UnifiedCourtCalendarProps) {
  // ── URL-Zustand (Phase 1: eine geteilte Kalender-URL zeigt beim Empfänger
  // dieselbe Ansicht) — die URL gewinnt immer gegenüber defaultView.
  // Eigene Parameter-Namen (`calView` statt `view`): `places-hub-tabs.tsx`
  // bettet den Kalender in einen Tab ein, der bereits `?view=calendar|manage`
  // für die Tab-Auswahl benutzt — ein gemeinsamer Name würde sich überschreiben. ──
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlView = searchParams.get('calView');
  const urlDate = parseDateParam(searchParams.get('calDate'));

  // ── State ──
  const [viewMode, setViewMode] = useState<ViewMode>(
    isViewMode(urlView) ? urlView : (defaultView ?? 'agenda')
  );
  // ── Agenda view (Tages-Buchungsflow) state ──
  const [agendaExpandedSlot, setAgendaExpandedSlot] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(urlDate ?? new Date());
  const [selectedDate, setSelectedDate] = useState(urlDate ?? new Date());
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(urlDate ?? new Date());
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(
    searchParams.get('calCourt')
  );
  const isMobile = useIsMobile();

  // Rollen-Vorgabe (Mitglied → agenda, Trainer/Admin → weekly) nachziehen, sobald
  // die Rollen geladen sind — nur wenn weder die URL noch der Aufrufer
  // (`defaultView`-Prop) schon etwas vorgegeben haben.
  const roleViewAppliedRef = useRef(false);

  // ── Kalender-Zustand zurück in die URL schreiben ──
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('calView', viewMode);
    params.set('calDate', format(viewMode === 'weekly' ? currentWeek : selectedDate, 'yyyy-MM-dd'));
    if (selectedCourtId) params.set('calCourt', selectedCourtId);
    else params.delete('calCourt');
    const next = `${pathname}?${params.toString()}`;
    if (next !== `${pathname}?${searchParams.toString()}`) {
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentWeek, selectedDate, selectedCourtId, pathname]);

  // ── Block dialog state ──
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockCourtId, setBlockCourtId] = useState<string>('');
  const [blockDate, setBlockDate] = useState<Date>(new Date());
  const [blockTimeSlot, setBlockTimeSlot] = useState<string>('');
  const [blockType, setBlockType] = useState<'event' | 'maintenance' | 'weather'>('event');
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockDuration, setBlockDuration] = useState(1);

  // ── Trainer ad-hoc session dialog state ──
  const [adHocDialogOpen, setAdHocDialogOpen] = useState(false);
  const [adHocCourtId, setAdHocCourtId] = useState<string>('');
  const [adHocDate, setAdHocDate] = useState<Date>(new Date());
  const [adHocTimeSlot, setAdHocTimeSlot] = useState<string>('');
  const [adHocDuration, setAdHocDuration] = useState(1);
  const [adHocMaxParticipants, setAdHocMaxParticipants] = useState(4);
  const [adHocNotes, setAdHocNotes] = useState('');
  const [adHocLoading, setAdHocLoading] = useState(false);

  // ── Session Cancel state ──
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  const [cancelSessionLabel, setCancelSessionLabel] = useState('');

  const handleOpenCancelSession = useCallback((session: Session) => {
    const start = session.timeslotStart ? new Date(session.timeslotStart) : null;
    const label = start
      ? start.toLocaleString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' Uhr'
      : `${session.startTime}–${session.endTime}`;
    setCancelSessionId(session.id);
    setCancelSessionLabel(label);
  }, []);

  // ── Weather & Court Closures state ──
  const [weatherData, setWeatherData] = useState<{
    temperature: number;
    condition: string;
    description: string;
    windSpeed: number;
    precipitation: number;
    recommendation: 'green' | 'yellow' | 'red';
    city: string;
  } | null>(null);
  const [courtClosures, setCourtClosures] = useState<CourtClosure[]>([]);

  // ── User context ──
  const { data: clubData } = useUserClub();
  const openingHours = clubData?.club?.openingHours ?? null;
  const { data: memberData } = useUserMember();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();

  const clubId = clubData?.clubId ?? initialClubId ?? null;
  const actingAsMemberId = useActingAsMemberId();
  const memberId = actingAsMemberId ?? memberData?.memberId ?? null;
  const isAdmin = userRoles.some((r) => r === 'admin' || r === 'superadmin');
  const isTrainer = userRoles.some((r) => r === 'trainer');

  useEffect(() => {
    if (roleViewAppliedRef.current || rolesLoading) return;
    roleViewAppliedRef.current = true;
    if (isViewMode(urlView) || defaultView !== undefined) return; // URL/Aufrufer gewinnt
    if (isAdmin || isTrainer) setViewMode('weekly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, isAdmin, isTrainer]);

  // Trainer record ID (trainers.id, not auth user ID) — used to filter own sessions.
  // Über Route → resolveTrainerRecordId statt direktem Supabase-Zugriff mit
  // E-Mail-Textvergleich (ADR-005, siehe docs/ARCHIV/2026-09-17-ux-analyse-und-
  // sanierungsprompt.md § 2.3).
  const [trainerRecordId, setTrainerRecordId] = useState<string | null>(null);
  useEffect(() => {
    if (!isTrainer) return;
    let cancelled = false;
    apiFetch('/api/trainer/record-id')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setTrainerRecordId(data?.trainerId ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [isTrainer]);

  // ── Data fetching ──
  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(
    clubId,
    undefined,
    actingAsMemberId
  );
  const { data: seasonPlanData } = useSeasonPlanGrid(activeSeasonId);
  const planSlots: PlanEntry[] = useMemo(() => seasonPlanData?.slots ?? [], [seasonPlanData]);

  // ── Member group filtering (role-based view) ──
  const { data: memberGroupIds = [] } = useMemberGroupIds(clubId);

  // ── Trainerstunden (vierte Slot-Quelle, Phase 2.1.2) — nur für die Agenda-
  // Ansicht des jeweils ausgewählten Tages geladen, sie sind platzunabhängig. ──
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: trainerHourSlots = [] } = useTrainerHourSlots(
    clubId,
    selectedDateStr,
    selectedDateStr
  );
  const trainerHourSlotsForDay = useMemo(
    () => trainerHourSlots.filter((s) => s.date === selectedDateStr),
    [trainerHourSlots, selectedDateStr]
  );
  const bookTrainerHourSlot = useBookTrainerHourSlot();
  const waitlistTrainerHourSlot = useWaitlistTrainerHourSlot();

  /** Sessions visible to the current user. Admin sees all; trainer sees own sessions; member sees group sessions + own bookings. */
  const visibleSessions = useMemo(() => {
    if (isAdmin) return sessions;
    if (isTrainer && trainerRecordId)
      return sessions.filter((s: Session) => s.trainerId === trainerRecordId);
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
  }, [sessions, isAdmin, isTrainer, trainerRecordId, memberGroupIds]);

  /** Plan entries visible to the current user. Admin sees all; trainer sees their entries; member sees only their groups. */
  const visiblePlanSlots = useMemo(() => {
    if (isAdmin) return planSlots;
    if (isTrainer && trainerRecordId)
      return planSlots.filter((e: PlanEntry) => e.trainer_id === trainerRecordId);
    if (memberGroupIds.length === 0) return []; // No groups → no plan entries visible
    const groupSet = new Set(memberGroupIds);
    return planSlots.filter((e: PlanEntry) => e.group_id && groupSet.has(e.group_id));
  }, [planSlots, isAdmin, isTrainer, trainerRecordId, memberGroupIds]);

  // ── Court selection: derive effective court ID ──
  // If courts loaded but selected court no longer exists, fall back to card view
  const selectedCourt = selectedCourtId ? courts.find((c) => c.id === selectedCourtId) : null;
  const effectiveCourtId =
    selectedCourtId && courts.length > 0 && !selectedCourt ? null : selectedCourtId;

  // ── Mutations ──
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();

  // ── Monatsansicht (Phase 2.1: übernommen aus /bookings) — bucht direkt über
  // die Session-ID statt über Platz+Zeit wie handleBookSlot. ──
  const handleBookSession = useCallback(
    (sessionId: string) => {
      if (!memberId || !clubId) {
        toast.error('Bitte einloggen um zu buchen');
        return;
      }
      createBooking.mutate({ memberId, sessionId, clubId });
    },
    [memberId, clubId, createBooking]
  );
  const handleStatusChange = useCallback(
    (bookingId: string, status: 'pending' | 'confirmed' | 'cancelled' | 'no_show') => {
      if (!clubId) return;
      updateBookingStatus.mutate({ bookingId, status, clubId });
    },
    [clubId, updateBookingStatus]
  );

  // ── DnD sensors (admin only) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Touch swipe ref (mobile day-pill navigation) ──
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch active court closures (alle Rollen — sonst sehen Member/Trainer
  //    admin-gesetzte Sperren nicht im Grid) ──
  const fetchClosures = useCallback(async () => {
    if (!clubId) return;
    try {
      const res = await apiFetch('/api/weather/closures?active=true');
      if (res.ok) {
        const data = await res.json();
        setCourtClosures(data.closures ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [clubId]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  // ── Fetch weather forecast (admin only — rein informativ) ──
  useEffect(() => {
    if (!clubId || !isAdmin) return;
    const fetchWeather = async () => {
      try {
        const res = await apiFetch('/api/weather/check');
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data.weather ? { ...data.weather, city: data.city ?? 'Berlin' } : null);
        }
      } catch {
        /* ignore */
      }
    };
    fetchWeather();
  }, [clubId, isAdmin]);

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
    else if (viewMode === 'month') setSelectedDate(subMonths(selectedDate, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  };
  const goToNext = () => {
    if (viewMode === 'weekly') setCurrentWeek(addWeeks(currentWeek, 1));
    else if (viewMode === 'month') setSelectedDate(addMonths(selectedDate, 1));
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

  // ── "Nächster freier Platz" ──
  const getPlanEntriesForNextFree = useCallback(
    (courtId: string, dayOfWeek: number) =>
      getPlanEntriesForCourtAndDay(courtId, dayOfWeek).filter(
        (e): e is PlanEntry & { court_id: string } => e.court_id !== null
      ),
    [getPlanEntriesForCourtAndDay]
  );
  const nextFreeSlot = useMemo(
    () =>
      findNextFreeSlot(
        courts,
        visibleSessions,
        courtClosures,
        getPlanEntriesForNextFree,
        openingHours
      ),
    [courts, visibleSessions, courtClosures, getPlanEntriesForNextFree, openingHours]
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
          toast.error(extractErrorMessage(err) ?? 'Direktbuchung fehlgeschlagen');
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
      // Defense in depth: auch offene Sessions an geschlossenen Tagen nicht buchen.
      if (isDayClosed(openingHours, date)) {
        toast.error(CLOSED_DAY_ERROR);
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
    [memberId, clubId, sessions, createBooking, directBookSlot, openingHours]
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
          blockType: blockType === 'weather' ? 'maintenance' : blockType,
          reason: blockReason || (blockType === 'weather' ? 'Wetterbedingungen' : undefined),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(extractErrorMessage(err) ?? 'Sperrung fehlgeschlagen');
        return;
      }
      const blockLabel =
        blockType === 'event' ? 'Veranstaltung' : blockType === 'weather' ? 'Wetter' : 'Wartung';
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
          toast.error(extractErrorMessage(err) ?? 'Sperrung konnte nicht aufgehoben werden');
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

  // ── Closure (court_closures) unblock — separate von handleUnblockSlot, das nur
  //    sessions-basierte Blocks kennt ──
  const handleRemoveClosure = useCallback(
    async (closureId: string) => {
      const confirmed = window.confirm('Sperrung aufheben? Der Platz wird wieder freigegeben.');
      if (!confirmed) return;
      try {
        const res = await apiFetch(`/api/weather/closures/${closureId}`, { method: 'DELETE' });
        if (!res.ok) {
          toast.error('Sperrung konnte nicht aufgehoben werden');
          return;
        }
        toast.success('Sperrung aufgehoben');
        void fetchClosures();
      } catch {
        toast.error('Netzwerkfehler beim Entsperren');
      }
    },
    [fetchClosures]
  );

  // ── Trainer: einmalige Einheit eintragen ──
  const openAdHocDialog = useCallback((courtId: string, date: Date, timeSlot: string) => {
    setAdHocCourtId(courtId);
    setAdHocDate(date);
    setAdHocTimeSlot(timeSlot);
    setAdHocDuration(1);
    setAdHocMaxParticipants(4);
    setAdHocNotes('');
    setAdHocDialogOpen(true);
  }, []);

  const handleCreateAdHoc = useCallback(async () => {
    if (!clubId) return;
    const [h, m] = adHocTimeSlot.split(':').map(Number);
    if (h + adHocDuration > 23) {
      toast.error('Einheit endet nach 23:00 Uhr — bitte kürzere Dauer wählen');
      return;
    }
    setAdHocLoading(true);
    try {
      const dateStr = format(adHocDate, 'yyyy-MM-dd');
      const endH = h + adHocDuration;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const res = await apiFetch('/api/sessions/ad-hoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: adHocCourtId,
          date: dateStr,
          startTime: adHocTimeSlot,
          endTime,
          clubId,
          maxParticipants: adHocMaxParticipants,
          notes: adHocNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(extractErrorMessage(err) ?? 'Einheit konnte nicht angelegt werden');
        return;
      }
      toast.success('Einheit eingetragen');
      setAdHocDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch {
      toast.error('Netzwerkfehler beim Eintragen');
    } finally {
      setAdHocLoading(false);
    }
  }, [
    clubId,
    adHocCourtId,
    adHocDate,
    adHocTimeSlot,
    adHocDuration,
    adHocMaxParticipants,
    adHocNotes,
    queryClient,
  ]);

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
          throw new Error(extractErrorMessage(err) || 'Update failed');
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
          <div className="h-8 w-48 bg-muted rounded-xl animate-pulse" />
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
     Shared header pieces (View-Toggle + Rollen-Aktionen) — von Agenda- UND
     Wochen-/Tagesansicht genutzt, damit beide nicht auseinanderlaufen.
     ═══════════════════════════════════════════════════ */
  const viewToggleEl = (
    <div className="flex rounded-xl border border-border overflow-hidden">
      <Button
        variant={viewMode === 'agenda' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none"
        onClick={() => setViewMode('agenda')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Heute
      </Button>
      <Button
        variant={viewMode === 'weekly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-x border-border"
        onClick={() => setViewMode('weekly')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Woche
      </Button>
      <Button
        variant={viewMode === 'month' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-r border-border"
        onClick={() => setViewMode('month')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Monat
      </Button>
      {(isAdmin || isTrainer) && (
        <Button
          variant={viewMode === 'daily' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-r border-border"
          onClick={() => setViewMode('daily')}
        >
          <CalendarIcon className="h-4 w-4 mr-1.5" />
          Tag (Planung)
        </Button>
      )}
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
  );

  const roleActionButtonsEl = (
    <>
      <Button variant="outline" size="sm" onClick={handleExportICS}>
        <Download className="h-4 w-4 mr-2" />
        ICS
      </Button>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const d = viewMode === 'daily' || viewMode === 'agenda' ? selectedDate : new Date();
            openBlockDialog(selectedCourtId ?? courts[0]?.id ?? '', d, '10:00');
          }}
        >
          <Lock className="h-4 w-4" />
          Sperren
        </Button>
      )}
      {isTrainer && !isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const d = viewMode === 'daily' || viewMode === 'agenda' ? selectedDate : new Date();
            openAdHocDialog(selectedCourtId ?? courts[0]?.id ?? '', d, '10:00');
          }}
        >
          <CalendarIcon className="h-4 w-4" />
          Einheit eintragen
        </Button>
      )}
    </>
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Agenda View (Tages-Buchungsflow — Standard für alle Rollen)
     Platz-Umschalter + Agenda-Karten statt Wochenzeilen. Ersetzt die frühere
     reine Kartenauswahl-Seite für Member — die übernimmt jetzt der Pillen-Umschalter.
     ═══════════════════════════════════════════════════ */
  if (viewMode === 'agenda') {
    return renderAgendaView();
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Month View (Phase 2.1 — übernommen aus /bookings)
     ═══════════════════════════════════════════════════ */
  if (viewMode === 'month') {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {viewToggleEl}
          {roleActionButtonsEl}
        </div>
        <MonthView
          sessions={visibleSessions}
          isLoading={sessionsLoading}
          currentMonth={selectedDate}
          onPrevMonth={goToPrevious}
          onNextMonth={goToNext}
          onToday={goToToday}
          memberId={memberId}
          clubId={clubId}
          canManageStatus={isAdmin || isTrainer}
          onBookSession={handleBookSession}
          onCancelBooking={handleCancelBooking}
          onStatusChange={handleStatusChange}
        />
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
              <span className="text-2xs opacity-80">{format(day, 'EEE', { locale: de })}</span>
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
        className="will-change-transform"
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
                  {/* Time slots */}
                  <div className="space-y-0.5">
                    {TIME_SLOTS.map((timeSlot) => {
                      const { status, session, closure, planEntry, closedDay } = getSlotStatus(
                        court.id,
                        day,
                        timeSlot,
                        visibleSessions,
                        planEntriesForDay.filter(
                          (e): e is PlanEntry & { court_id: string } => e.court_id !== null
                        ),
                        courtClosures,
                        openingHours
                      );
                      const dropTargetId = `${court.id}::${day.toISOString()}::${timeSlot}`;

                      return (
                        <DroppableSlot key={timeSlot} id={dropTargetId} isAdmin={isAdmin}>
                          <div
                            className={`group min-h-[44px] rounded-xl text-2xs flex items-center transition-all duration-150 ${
                              status === 'blocked' && isAdmin && !closedDay
                                ? SLOT_STATUS_STYLES_ADMIN_BLOCKED
                                : SLOT_STATUS_STYLES[status]
                            }`}
                            role="button"
                            tabIndex={
                              (!isAdmin && status === 'available') ||
                              (isAdmin &&
                                (status === 'available' || (status === 'blocked' && !closedDay)))
                                ? 0
                                : -1
                            }
                            onClick={
                              isAdmin && status === 'available'
                                ? () => openBlockDialog(court.id, day, timeSlot)
                                : isAdmin && status === 'blocked' && session
                                  ? () => handleUnblockSlot(session.id)
                                  : isAdmin && status === 'blocked' && closure
                                    ? () => handleRemoveClosure(closure.id)
                                    : !isAdmin && isTrainer && status === 'available'
                                      ? () => openAdHocDialog(court.id, day, timeSlot)
                                      : !isAdmin && !isTrainer && status === 'available'
                                        ? () => handleBookSlot(court.id, day, timeSlot)
                                        : undefined
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isAdmin && status === 'available') {
                                  openBlockDialog(court.id, day, timeSlot);
                                } else if (isAdmin && status === 'blocked' && session) {
                                  handleUnblockSlot(session.id);
                                } else if (isAdmin && status === 'blocked' && closure) {
                                  handleRemoveClosure(closure.id);
                                } else if (!isAdmin && isTrainer && status === 'available') {
                                  openAdHocDialog(court.id, day, timeSlot);
                                } else if (!isAdmin && !isTrainer && status === 'available') {
                                  handleBookSlot(court.id, day, timeSlot);
                                }
                              }
                            }}
                          >
                            {status === 'blocked' && session ? (
                              isAdmin ? (
                                <div className="flex items-center gap-1 w-full justify-between px-2">
                                  <div className="flex items-center gap-1.5">
                                    {session.sessionType === 'maintenance' ? (
                                      <Wrench className="h-3 w-3 text-gray-500" />
                                    ) : (
                                      <PartyPopper className="h-3 w-3 text-gray-500" />
                                    )}
                                    <span className="truncate text-2xs font-semibold">
                                      {session.notes?.substring(0, 12) ||
                                        (session.sessionType === 'maintenance'
                                          ? 'Wartung'
                                          : 'Event')}
                                    </span>
                                  </div>
                                  <Unlock className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2">
                                  <Lock className="h-3 w-3 text-gray-400" />
                                  <span className="text-2xs font-semibold">Gesperrt</span>
                                </div>
                              )
                            ) : status === 'blocked' && closure ? (
                              isAdmin ? (
                                <div className="flex items-center gap-1 w-full justify-between px-2">
                                  <div className="flex items-center gap-1.5">
                                    <Lock className="h-3 w-3 text-gray-500" />
                                    <span className="truncate text-2xs font-semibold">
                                      {closure.description?.substring(0, 12) ||
                                        REASON_LABEL_SHORT[closure.reason] ||
                                        closure.reason}
                                    </span>
                                  </div>
                                  <Unlock className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2">
                                  <Lock className="h-3 w-3 text-gray-400" />
                                  <span className="text-2xs font-semibold">Gesperrt</span>
                                </div>
                              )
                            ) : status === 'blocked' && closedDay ? (
                              <div className="flex items-center gap-1.5 px-2">
                                <Lock className="h-3 w-3 text-gray-400" />
                                <span className="text-2xs font-semibold">Geschlossen</span>
                              </div>
                            ) : session ? (
                              isAdmin ? (
                                <DraggableSessionCard
                                  session={session}
                                  isDragging={activeId === session.id}
                                  onCancelSession={handleOpenCancelSession}
                                />
                              ) : session.bookedByUser ? (
                                <div className="flex items-center gap-1 w-full justify-between px-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-2 h-2 rounded-full bg-error-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-2xs font-bold truncate text-error-700 block">
                                        Deine Buchung
                                      </span>
                                      <span className="text-3xs text-error-500 font-medium">
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
                                      className="p-0.5 rounded-md hover:bg-error-200 text-error-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
                                        <Lock className="h-3.5 w-3.5 text-warning-700" />
                                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-2xs font-bold truncate text-warning-900 block">
                                          Belegt
                                        </span>
                                        <span className="text-3xs text-warning-700 font-semibold">
                                          {session.startTime}–{session.endTime}
                                        </span>
                                      </div>{' '}
                                      {session.currentBookings && session.currentBookings > 0 && (
                                        <span className="flex-shrink-0 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-warning-600 text-white text-3xs font-bold">
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
                                  <User className="h-3 w-3 text-info-500 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="truncate text-2xs font-bold text-info-800 block">
                                      {session.trainerName?.substring(0, 12) || 'Trainer'}
                                    </span>
                                    <span className="text-3xs text-info-500 font-medium">
                                      {session.startTime}–{session.endTime}
                                    </span>
                                  </div>
                                </div>
                              )
                            ) : status === 'plan' ? (
                              <div className="flex items-center gap-1.5 px-2 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${planEntry?.group_color ? '' : 'bg-info-500'}`}
                                  style={
                                    planEntry?.group_color
                                      ? { backgroundColor: planEntry.group_color }
                                      : undefined
                                  }
                                />
                                <div className="min-w-0">
                                  <span className="text-2xs truncate font-semibold text-info-700 block">
                                    {planEntry?.group_name || 'Gruppentraining'}
                                  </span>
                                  {planEntry?.trainer_name && (
                                    <span className="text-3xs text-info-500 font-medium truncate block">
                                      {planEntry.trainer_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-2xs px-2 text-success-600/70 font-medium">
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
     RENDER: Agenda View — Tages-Buchungsflow (Standard für alle Rollen)
     Platz-Umschalter (Pillen) + Agenda-Karten. Statusfarbe ist reserviert und
     läuft nur über einen schmalen Akzentbalken + Icon + ein Label — nie über
     eine volle Kartenfläche (siehe Farb-Review). Klick auf eine freie Karte
     klappt ein rollen-abhängiges Inline-Panel auf statt ein Modal zu öffnen —
     der Kalender bleibt dabei sichtbar.
     ═══════════════════════════════════════════════════ */
  function renderAgendaView() {
    const activeCourtId = selectedCourtId ?? courts[0]?.id ?? null;
    const activeCourt = activeCourtId ? (courts.find((c) => c.id === activeCourtId) ?? null) : null;
    const planEntriesForDay = activeCourtId
      ? getPlanEntriesForCourtAndDay(activeCourtId, dateFnsGetDay(selectedDate)).filter(
          (e): e is PlanEntry & { court_id: string } => e.court_id !== null
        )
      : [];
    const isToday = isSameDay(selectedDate, new Date());
    const nextFreeLabel =
      nextFreeSlot &&
      `${isSameDay(nextFreeSlot.date, new Date()) ? 'Heute' : format(nextFreeSlot.date, 'EEEE', { locale: de })} ${nextFreeSlot.timeSlot} Uhr · ${nextFreeSlot.courtName}`;

    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <CourtCalendarHeader
          title="Heute"
          subtitle={`${format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}${activeCourt ? ' · ' + activeCourt.name : ''}`}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onGoPrevious={goToPrevious}
          onGoNext={goToNext}
          onGoToday={goToToday}
        >
          {viewToggleEl}
          {roleActionButtonsEl}
        </CourtCalendarHeader>

        {/* Platz-Umschalter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {courts.map((court) => (
            <button
              key={court.id}
              onClick={() => {
                setSelectedCourtId(court.id);
                setAgendaExpandedSlot(null);
              }}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                court.id === activeCourtId
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {court.name}
            </button>
          ))}
        </div>

        {/* Nächster freier Platz */}
        {nextFreeSlot && nextFreeLabel && (
          <button
            onClick={() => {
              setSelectedCourtId(nextFreeSlot.courtId);
              setSelectedDate(nextFreeSlot.date);
              setAgendaExpandedSlot(nextFreeSlot.timeSlot);
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.1] transition-colors px-4 py-3 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
              <Search className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">Nächster freier Platz</div>
              <div className="text-xs text-muted-foreground">{nextFreeLabel}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
          </button>
        )}

        {/* Agenda-Liste */}
        {activeCourtId && (
          <div className="flex flex-col gap-2">
            {TIME_SLOTS.map((timeSlot) => {
              const { status, session, closure, closedDay } = getSlotStatus(
                activeCourtId,
                selectedDate,
                timeSlot,
                visibleSessions,
                planEntriesForDay,
                courtClosures,
                openingHours
              );
              const [slotH, slotM] = timeSlot.split(':').map(Number);
              const isPast =
                isToday &&
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  selectedDate.getDate(),
                  slotH,
                  slotM
                ) < new Date();
              const isExpanded = agendaExpandedSlot === timeSlot;
              const isMember = !isAdmin && !isTrainer;

              // Mitglieder dürfen auch eine bereits geplante, noch offene Session antippen
              // (status "session" = Trainingszeit ohne Buchung) — nicht nur leere Slots.
              const canAct =
                !isPast && (status === 'available' || (status === 'session' && isMember));
              const canOwnCancel = status === 'own-booking' && session?.bookingId;
              const canAdminUnblock = isAdmin && status === 'blocked' && !closedDay;

              let bar = '';
              let icon = <Plus className="h-3.5 w-3.5" />;
              let label = 'Frei';
              let meta = '';
              let cardClass = 'border-dashed border-border text-muted-foreground bg-transparent';

              if (status === 'session') {
                bar = 'bg-info-500';
                icon = <User className="h-3.5 w-3.5 text-info-500" />;
                label = session?.trainerName || 'Offene Session';
                const free = Math.max(
                  0,
                  (session?.maxParticipants ?? 0) - (session?.currentBookings ?? 0)
                );
                meta = `${free} frei`;
                cardClass = 'border-border bg-card';
              } else if (status === 'booked') {
                bar = 'bg-gray-500';
                icon = <Lock className="h-3.5 w-3.5 text-gray-500" />;
                label = 'Belegt';
                meta = `${session?.currentBookings ?? 0}/${session?.maxParticipants ?? 0}`;
                cardClass = 'border-border bg-card';
              } else if (status === 'own-booking') {
                bar = 'bg-brand-light';
                icon = <div className="w-2.5 h-2.5 rounded-full bg-brand-light" />;
                label = 'Deine Buchung';
                meta = `${session?.startTime ?? timeSlot}–${session?.endTime ?? ''}`;
                cardClass = 'border-brand-light/30 bg-card';
              } else if (status === 'blocked') {
                bar = 'bg-gray-700';
                icon = <Lock className="h-3.5 w-3.5 text-gray-600" />;
                label = closedDay
                  ? 'Geschlossen'
                  : isAdmin
                    ? closure
                      ? closure.description || REASON_LABEL_SHORT[closure.reason] || closure.reason
                      : session?.notes ||
                        (session?.sessionType === 'maintenance' ? 'Wartung' : 'Event')
                    : 'Gesperrt';
                cardClass = 'border-border bg-muted/40 text-muted-foreground';
              } else if (status === 'plan') {
                bar = 'bg-info-300';
                icon = <Users className="h-3.5 w-3.5 text-info-400" />;
                label = 'Gruppentraining';
                cardClass = 'border-dashed border-info-200 bg-info-50/40 text-info-700';
              } else if (isPast) {
                cardClass = 'border-border bg-transparent text-muted-foreground/60';
                label = 'Vorbei';
              }

              const clickable = canAct || canOwnCancel || canAdminUnblock;

              const activateCard = () => {
                if (canAct) {
                  if (isMember) setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                  else if (isTrainer) {
                    setAdHocCourtId(activeCourtId);
                    setAdHocDate(selectedDate);
                    setAdHocTimeSlot(timeSlot);
                    setAdHocDuration(1);
                    setAdHocMaxParticipants(4);
                    setAdHocNotes('');
                    setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                  } else if (isAdmin) {
                    setBlockCourtId(activeCourtId);
                    setBlockDate(selectedDate);
                    setBlockTimeSlot(timeSlot);
                    setBlockType('event');
                    setBlockReason('');
                    setBlockDuration(1);
                    setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                  }
                } else if (canOwnCancel && session) {
                  handleCancelBooking(session.id, session.bookingId!);
                } else if (canAdminUnblock) {
                  if (closure) handleRemoveClosure(closure.id);
                  else if (session) handleUnblockSlot(session.id);
                }
              };

              return (
                <div key={timeSlot}>
                  <div
                    className={`relative flex items-center gap-3 rounded-xl border pl-4 pr-3 py-2.5 transition-colors ${cardClass} ${
                      clickable ? 'cursor-pointer hover:shadow-sm' : ''
                    }`}
                    role="button"
                    tabIndex={clickable ? 0 : -1}
                    onClick={clickable ? activateCard : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              activateCard();
                            }
                          }
                        : undefined
                    }
                  >
                    {bar && (
                      <span
                        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${bar}`}
                      />
                    )}
                    <span className="w-11 flex-shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                      {timeSlot}
                    </span>
                    {icon}
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate">{label}</span>
                    {meta && (
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                        {meta}
                      </span>
                    )}
                    {canOwnCancel && <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </div>

                  {/* Inline-Panel — Kalender bleibt sichtbar, kein Modal */}
                  {isExpanded && (status === 'available' || (status === 'session' && isMember)) && (
                    <div className="mt-1.5 ml-4 mr-3 rounded-xl border border-border bg-muted/30 p-3">
                      {isMember && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-foreground">
                            Platz {activeCourt?.name} um {timeSlot} Uhr buchen?
                          </span>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAgendaExpandedSlot(null)}
                            >
                              Abbrechen
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                handleBookSlot(activeCourtId, selectedDate, timeSlot);
                                setAgendaExpandedSlot(null);
                              }}
                            >
                              Jetzt buchen
                            </Button>
                          </div>
                        </div>
                      )}
                      {isTrainer && !isAdmin && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs shrink-0">Dauer</Label>
                            {[1, 2, 3, 4].map((h) => (
                              <Button
                                key={h}
                                type="button"
                                size="sm"
                                variant={adHocDuration === h ? 'default' : 'outline'}
                                className="h-7 px-2.5 text-xs"
                                onClick={() => setAdHocDuration(h)}
                              >
                                {h}h
                              </Button>
                            ))}
                          </div>
                          <Input
                            placeholder="Notiz (optional)"
                            value={adHocNotes}
                            onChange={(e) => setAdHocNotes(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAgendaExpandedSlot(null)}
                            >
                              Abbrechen
                            </Button>
                            <Button size="sm" disabled={adHocLoading} onClick={handleCreateAdHoc}>
                              {adHocLoading ? 'Wird eingetragen...' : 'Eintragen'}
                            </Button>
                          </div>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(['event', 'maintenance', 'weather'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setBlockType(t)}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                  blockType === t
                                    ? 'bg-gray-700 text-white border-gray-700'
                                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                                }`}
                              >
                                {t === 'event'
                                  ? 'Event'
                                  : t === 'maintenance'
                                    ? 'Wartung'
                                    : 'Wetter'}
                              </button>
                            ))}
                            {[1, 2, 3, 4].map((h) => (
                              <Button
                                key={h}
                                type="button"
                                size="sm"
                                variant={blockDuration === h ? 'default' : 'outline'}
                                className="h-7 px-2.5 text-xs"
                                onClick={() => setBlockDuration(h)}
                              >
                                {h}h
                              </Button>
                            ))}
                          </div>
                          <Input
                            placeholder="Grund (optional)"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAgendaExpandedSlot(null)}
                            >
                              Abbrechen
                            </Button>
                            <Button size="sm" disabled={blockLoading} onClick={handleBlockSlot}>
                              {blockLoading ? 'Wird gesperrt...' : 'Sperren'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <CourtCalendarLegend items={getCalendarLegendItems(isAdmin)} />

        <TrainerHourSlotsSection
          slots={trainerHourSlotsForDay}
          isMember={!isAdmin && !isTrainer}
          onBook={(slot) => bookTrainerHourSlot.mutateAsync(slot)}
          onWaitlist={(slot) => waitlistTrainerHourSlot.mutateAsync(slot)}
          bookLoading={bookTrainerHourSlot.isPending}
          waitlistLoading={waitlistTrainerHourSlot.isPending}
        />
      </div>
    );
  }

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
                <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-2xs font-bold">
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
                    <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-muted text-3xs sm:text-3xs font-medium text-muted-foreground border border-border/50">
                      {getSurfaceLabel(court.surface)}
                    </span>
                    {court.hasIndoor && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-info-50 text-3xs sm:text-3xs font-medium text-info-600 border border-info-100">
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
                    className="absolute left-0 top-0 text-right pr-1 sm:pr-2 -translate-y-2 text-2xs font-medium text-muted-foreground tabular-nums"
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

                  // Closures (court_closures) für diesen Platz/Tag, auf DAILY_HOURS geclippt
                  const dayWindowStart = new Date(
                    targetDate.getFullYear(),
                    targetDate.getMonth(),
                    targetDate.getDate(),
                    gridStartHour,
                    0,
                    0
                  );
                  const dayWindowEnd = new Date(
                    targetDate.getFullYear(),
                    targetDate.getMonth(),
                    targetDate.getDate(),
                    gridStartHour + totalHours,
                    0,
                    0
                  );
                  const toHHMM = (d: Date) =>
                    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  const courtClosuresForDay = courtClosures
                    .filter((c) => c.court_id === court.id)
                    .map((c) => {
                      const rangeStart = new Date(c.start_date);
                      const rangeEnd = c.end_date ? new Date(c.end_date) : null;
                      const overlaps = rangeEnd
                        ? rangeStart < dayWindowEnd && rangeEnd > dayWindowStart
                        : rangeStart < dayWindowEnd;
                      if (!overlaps) return null;
                      const clippedStart =
                        rangeStart > dayWindowStart ? rangeStart : dayWindowStart;
                      const clippedEnd =
                        rangeEnd && rangeEnd < dayWindowEnd ? rangeEnd : dayWindowEnd;
                      return {
                        closure: c,
                        startTime: toHHMM(clippedStart),
                        endTime: toHHMM(clippedEnd),
                      };
                    })
                    .filter(
                      (x): x is { closure: CourtClosure; startTime: string; endTime: string } =>
                        x !== null
                    );

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

                      {/* Closure blocks (court_closures) */}
                      {courtClosuresForDay.map(({ closure, startTime, endTime }) => {
                        const pos = getBlockPosition(startTime, endTime, gridStartHour);
                        return (
                          <PositionedClosureBlock
                            key={closure.id}
                            closure={closure}
                            topPx={pos.topPx}
                            heightPx={pos.heightPx}
                            isAdmin={isAdmin}
                            onUnblock={handleRemoveClosure}
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
                            onCancelSession={isAdmin ? handleOpenCancelSession : undefined}
                          />
                        );
                      })}

                      {/* Clickable empty area */}
                      <div
                        className="absolute inset-0 z-0"
                        role="button"
                        tabIndex={isAdmin || isTrainer ? 0 : -1}
                        onClick={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (isAdmin) {
                            openBlockDialog(court.id, targetDate, '10:00');
                          } else if (isTrainer) {
                            openAdHocDialog(court.id, targetDate, '10:00');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          if (isAdmin) {
                            openBlockDialog(court.id, targetDate, '10:00');
                          } else if (isTrainer) {
                            openAdHocDialog(court.id, targetDate, '10:00');
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
                        <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-error-500 shadow-sm" />
                        <div className="h-0.5 bg-error-500 shadow-sm" />
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
        title={selectedCourt ? selectedCourt.name : 'Platzkalender'}
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
        {/* Platz-Filter (Admin/Trainer) — bei vielen Plätzen auf einen einschränken */}
        {(isAdmin || isTrainer) && courts.length > 1 && (
          <Select
            value={selectedCourtId ?? 'all'}
            onValueChange={(v) => setSelectedCourtId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Alle Plätze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Plätze</SelectItem>
              {courts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        {viewToggleEl}

        {/* Export + Rollen-Aktionen */}
        {roleActionButtonsEl}
      </CourtCalendarHeader>

      {/* Weather banner (admin only) */}
      {isAdmin && weatherData && (
        <Card>
          <CardContent className="flex items-center gap-3 p-3 text-sm">
            <IconBox
              icon={
                weatherData.condition === 'Rain' || weatherData.condition === 'Drizzle'
                  ? CloudRain
                  : weatherData.condition === 'Snow'
                    ? Snowflake
                    : weatherData.condition === 'Thunderstorm'
                      ? AlertTriangle
                      : weatherData.condition === 'Clear'
                        ? Sun
                        : Cloud
              }
              size="sm"
              variant={
                weatherData.recommendation === 'red'
                  ? 'red'
                  : weatherData.recommendation === 'yellow'
                    ? 'amber'
                    : 'green'
              }
            />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-foreground">{weatherData.city}</span>
              <span className="ml-2 text-muted-foreground">
                {Math.round(weatherData.temperature)}°C · {weatherData.description}
              </span>
              <span className="ml-2 text-xs text-muted-foreground/70">
                ({weatherData.windSpeed} m/s, {weatherData.precipitation} mm)
              </span>
            </div>
            {weatherData.recommendation !== 'green' && (
              <Badge
                variant={weatherData.recommendation === 'red' ? 'error' : 'warning'}
                className="whitespace-nowrap"
              >
                {weatherData.recommendation === 'red'
                  ? '⚠️ Außenplätze sperren'
                  : '⚡ Platz prüfen'}
              </Badge>
            )}
            <Link
              href="/admin/courts?view=manage&tab=closures"
              className="text-xs font-medium text-muted-foreground hover:text-brand-light transition-colors whitespace-nowrap"
            >
              Details →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Active closure indicators — für alle Rollen sichtbar (kein Namensleck, nur Grund) */}
      {courtClosures.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {courtClosures.map((c) => {
            const courtName = courts.find((ct) => ct.id === c.court_id)?.name ?? 'Platz';
            return (
              <div
                key={c.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand-accent-50 border border-brand-accent-200 text-brand-accent-800 text-xs font-medium dark:bg-brand-accent-950/30 dark:border-brand-accent-800 dark:text-brand-accent-300"
              >
                <Lock className="h-3 w-3" />
                <span>{courtName}</span>
                <span className="opacity-70">
                  ·{' '}
                  {c.reason === 'weather'
                    ? '🌧️ Wetter'
                    : c.reason === 'maintenance'
                      ? '🔧 Wartung'
                      : c.reason}
                </span>
                {c.description && <span className="opacity-60">· {c.description}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Zero-sessions warning (admin view) */}
      {isAdmin && visibleSessions.length === 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-800">
                Keine zukünftigen Sessions gefunden
              </p>
              <p className="text-sm text-warning-700 mt-1">
                Es sind aktuell keine Sessions für die Zukunft geplant. Bitte den{' '}
                <Link
                  href="/admin/seasons"
                  className="font-semibold text-warning-800 underline hover:text-warning-900 transition-colors"
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
     RENDER: Block Dialog + Trainer Ad-hoc Dialog
     (ausgelagert nach components/block-court-dialog.tsx und
     components/ad-hoc-session-dialog.tsx — Zustand bleibt hier, weil
     dieselben Setter auch vom Inline-Panel weiter oben befüllt werden)
     ═══════════════════════════════════════════════════ */

  const blockDialog = (
    <BlockCourtDialog
      open={blockDialogOpen}
      onClose={() => setBlockDialogOpen(false)}
      courtId={blockCourtId}
      courts={courts}
      date={blockDate}
      timeSlot={blockTimeSlot}
      blockType={blockType}
      onBlockTypeChange={setBlockType}
      weatherData={weatherData}
      duration={blockDuration}
      onDurationChange={setBlockDuration}
      reason={blockReason}
      onReasonChange={setBlockReason}
      onSubmit={handleBlockSlot}
      loading={blockLoading}
    />
  );

  const adHocDialog = (
    <AdHocSessionDialog
      open={adHocDialogOpen}
      onClose={() => setAdHocDialogOpen(false)}
      courtId={adHocCourtId}
      courts={courts}
      date={adHocDate}
      timeSlot={adHocTimeSlot}
      duration={adHocDuration}
      onDurationChange={setAdHocDuration}
      maxParticipants={adHocMaxParticipants}
      onMaxParticipantsChange={setAdHocMaxParticipants}
      notes={adHocNotes}
      onNotesChange={setAdHocNotes}
      onSubmit={handleCreateAdHoc}
      loading={adHocLoading}
    />
  );

  const sessionCancelDialogEl = cancelSessionId && (
    <SessionCancelDialog
      open={!!cancelSessionId}
      onClose={() => setCancelSessionId(null)}
      sessionId={cancelSessionId}
      sessionLabel={cancelSessionLabel}
      onSuccess={() => {
        setCancelSessionId(null);
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }}
    />
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
      {adHocDialog}
      {sessionCancelDialogEl}
    </>
  ) : (
    <>
      {content}
      {blockDialog}
      {adHocDialog}
      {sessionCancelDialogEl}
    </>
  );

  return <TooltipProvider delayDuration={200}>{wrappedContent}</TooltipProvider>;
}
