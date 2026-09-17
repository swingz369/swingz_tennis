'use client';

/**
 * Geteilte Bausteine für Wochen- und Tagesansicht des Platzkalenders:
 * draggable/droppable Blöcke, Positionierungs-Helfer und die Kurzlabel-Map
 * für Sperrgründe. Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan
 * Phase 2.2 — eine Datei je Ansichtsmodus statt einer 2800-Zeilen-Datei).
 */
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Clock, User, Users, Lock, Unlock, Wrench, PartyPopper } from 'lucide-react';
import type { Session } from '@/hooks/use-sessions';
import type { PlanEntry } from '@/components/calendar/types';
import { DAILY_BLOCK_STYLES, type CourtClosure } from '@/lib/court-calendar-utils';

/** Hours shown in the daily view time axis */
export const DAILY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

/** Pixels per hour in the daily time-axis grid */
export const PX_PER_HOUR = 64;

/** Kurzlabel für court_closures.reason im Grid (Platz ist knapp) */
export const REASON_LABEL_SHORT: Record<string, string> = {
  maintenance: 'Wartung',
  event: 'Event',
  tournament: 'Turnier',
  weather: 'Wetter',
  other: 'Sonstiges',
};

/** Convert "HH:MM" → minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Parse a session's start/end times to minutes from the grid start */
export function getBlockPosition(
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

export function DraggableSessionCard({
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

export function PositionedSessionBlock({
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

export function PositionedPlanBlock({
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
export function PositionedClosureBlock({
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

export function DroppableSlot({
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

export function DroppableHourZone({
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
