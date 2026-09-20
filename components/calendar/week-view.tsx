'use client';

/**
 * Wochenansicht des Platzkalenders. Auf Mobilgeräten wird statt des
 * 7-Spalten-Rasters ein horizontaler Tages-Pillenumschalter + die
 * (eingebettete) Tagesansicht gezeigt — swipebar per Touch.
 *
 * Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2).
 */
import { useRef } from 'react';
import {
  format,
  isSameDay,
  getDay as dateFnsGetDay,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, PartyPopper, Unlock, User, Wrench } from 'lucide-react';
import type { Session } from '@/hooks/use-sessions';
import type { DayOff } from '@/hooks/use-holidays';
import type { PlanEntry } from '@/components/calendar/types';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  getSlotStatus,
  SLOT_STATUS_STYLES,
  SLOT_STATUS_STYLES_ADMIN_BLOCKED,
  type CourtClosure,
} from '@/lib/court-calendar-utils';
import {
  CourtCalendarGrid,
  WeekDaysHeaderRow,
  CourtRowHeader,
} from '@/components/court-calendar-shared';
import {
  DraggableSessionCard,
  DroppableSlot,
  REASON_LABEL_SHORT,
} from '@/components/calendar/calendar-primitives';
import { DayView } from '@/components/calendar/day-view';

/** Stable DOM id für einen Wochenraster-Slot — Ziel der Pfeiltasten-Navigation
 *  (siehe onKeyDown weiter unten, Sanierungsplan Phase 5.2). */
function weekSlotId(courtId: string, day: Date, timeSlot: string): string {
  return `wv-slot-${courtId}-${format(day, 'yyyy-MM-dd')}-${timeSlot}`;
}

export interface WeekViewProps {
  isMobile: boolean;
  weekDays: Date[];
  dayOffFor: (date: Date) => DayOff | null;
  weekStart: Date;
  weekEnd: Date;
  currentWeek: Date;
  setCurrentWeek: (date: Date) => void;
  mobileSelectedDay: Date;
  setMobileSelectedDay: (date: Date) => void;
  displayCourts: { id: string; name: string; surface: string; hasIndoor?: boolean }[];
  getPlanEntriesForCourtAndDay: (courtId: string, dayOfWeek: number) => PlanEntry[];
  visibleSessions: Session[];
  sessions: Session[];
  courtClosures: CourtClosure[];
  openingHours: unknown;
  isAdmin: boolean;
  isTrainer: boolean;
  activeId: string | null;
  goToPrevious: () => void;
  goToNext: () => void;
  openBlockDialog: (courtId: string, date: Date, timeSlot: string) => void;
  handleUnblockSlot: (sessionId: string) => void;
  handleRemoveClosure: (closureId: string) => void;
  openAdHocDialog: (courtId: string, date: Date, timeSlot: string) => void;
  handleBookSlot: (courtId: string, date: Date, timeSlot: string) => void;
  handleCancelBooking: (sessionId: string, bookingId: string) => void;
  handleOpenCancelSession: (session: Session) => void;
}

export function WeekView({
  isMobile,
  weekDays,
  dayOffFor,
  weekStart,
  weekEnd,
  currentWeek,
  setCurrentWeek,
  mobileSelectedDay,
  setMobileSelectedDay,
  displayCourts,
  getPlanEntriesForCourtAndDay,
  visibleSessions,
  sessions,
  courtClosures,
  openingHours,
  isAdmin,
  isTrainer,
  activeId,
  goToPrevious,
  goToNext,
  openBlockDialog,
  handleUnblockSlot,
  handleRemoveClosure,
  openAdHocDialog,
  handleBookSlot,
  handleCancelBooking,
  handleOpenCancelSession,
}: WeekViewProps) {
  // ── Touch swipe ref (mobile day-pill navigation) ──
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipeContainerRef = useRef<HTMLDivElement>(null);

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

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Horizontal day selector (swipeable) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {weekDays.map((day) => {
            const today = isSameDay(day, new Date());
            const selected = isSameDay(day, mobileSelectedDay);
            const dayOff = dayOffFor(day);
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
                {dayOff && (
                  <span
                    className="mt-0.5 size-1.5 rounded-full bg-warning-500"
                    title={dayOff.name}
                  />
                )}
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
          <DayView
            targetDate={mobileSelectedDay}
            activeDragId={activeId}
            displayCourts={displayCourts}
            getPlanEntriesForCourtAndDay={getPlanEntriesForCourtAndDay}
            visibleSessions={visibleSessions}
            sessions={sessions}
            courtClosures={courtClosures}
            isMobile={isMobile}
            embedded
            isAdmin={isAdmin}
            isTrainer={isTrainer}
            goToPrevious={goToPrevious}
            goToNext={goToNext}
            handleRemoveClosure={handleRemoveClosure}
            handleBookSlot={handleBookSlot}
            openBlockDialog={openBlockDialog}
            handleUnblockSlot={handleUnblockSlot}
            handleCancelBooking={handleCancelBooking}
            handleOpenCancelSession={handleOpenCancelSession}
            openAdHocDialog={openAdHocDialog}
          />
        </div>
      </div>
    );
  }

  return (
    <CourtCalendarGrid>
      <WeekDaysHeaderRow weekDays={weekDays} dayOffFor={dayOffFor} />

      {displayCourts.map((court) => (
        <div key={court.id} className="border-b border-border/40 last:border-b-0">
          <div className="grid grid-cols-[180px_repeat(7,1fr)]">
            <CourtRowHeader court={court} />
            {weekDays.map((day, dayIdx) => {
              const planEntriesForDay = getPlanEntriesForCourtAndDay(court.id, dateFnsGetDay(day));

              return (
                <div
                  key={day.toISOString()}
                  className={`p-1.5 min-h-[420px] border-r border-border/20 last:border-r-0 ${
                    dayOffFor(day)
                      ? 'bg-warning-50/50 dark:bg-warning-900/10'
                      : isSameDay(day, new Date())
                        ? 'bg-primary/[0.03]'
                        : 'bg-background'
                  }`}
                >
                  {/* Time slots */}
                  <div className="space-y-0.5">
                    {TIME_SLOTS.map((timeSlot, timeIdx) => {
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
                            id={weekSlotId(court.id, day, timeSlot)}
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
                              // Pfeiltasten bewegen die Auswahl im Wochenraster:
                              // hoch/runter = Zeit, links/rechts = Tag (Sanierungsplan
                              // Phase 5.2). Direkter Fokuswechsel statt State, das
                              // Raster hat bereits eine stabile Zell-ID je Slot.
                              if (
                                e.key === 'ArrowUp' ||
                                e.key === 'ArrowDown' ||
                                e.key === 'ArrowLeft' ||
                                e.key === 'ArrowRight'
                              ) {
                                e.preventDefault();
                                const nextTimeIdx =
                                  e.key === 'ArrowUp'
                                    ? timeIdx - 1
                                    : e.key === 'ArrowDown'
                                      ? timeIdx + 1
                                      : timeIdx;
                                const nextDayIdx =
                                  e.key === 'ArrowLeft'
                                    ? dayIdx - 1
                                    : e.key === 'ArrowRight'
                                      ? dayIdx + 1
                                      : dayIdx;
                                if (
                                  nextTimeIdx < 0 ||
                                  nextTimeIdx >= TIME_SLOTS.length ||
                                  nextDayIdx < 0 ||
                                  nextDayIdx >= weekDays.length
                                ) {
                                  return;
                                }
                                document
                                  .getElementById(
                                    weekSlotId(
                                      court.id,
                                      weekDays[nextDayIdx],
                                      TIME_SLOTS[nextTimeIdx]
                                    )
                                  )
                                  ?.focus();
                                return;
                              }
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
}
