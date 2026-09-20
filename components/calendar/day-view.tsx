'use client';

/**
 * Tagesansicht des Platzkalenders — Google-Calendar-Style Time Axis.
 * Wird sowohl für den vollen Tagesmodus als auch (eingebettet) für die
 * mobile Wochenansicht (Tages-Pills) benutzt — daher `embedded`, das den
 * Tages-Navigations-Mini-Header ausblendet.
 *
 * Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2).
 */
import { format, isSameDay, getDay as dateFnsGetDay } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Session } from '@/hooks/use-sessions';
import type { PlanEntry } from '@/components/calendar/types';
import { getSurfaceLabel, type CourtClosure } from '@/lib/court-calendar-utils';
import {
  DAILY_HOURS,
  PX_PER_HOUR,
  getBlockPosition,
  PositionedSessionBlock,
  PositionedPlanBlock,
  PositionedClosureBlock,
  DroppableHourZone,
} from '@/components/calendar/calendar-primitives';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface DayViewProps {
  targetDate: Date;
  activeDragId?: string | null;
  displayCourts: { id: string; name: string; surface: string; hasIndoor?: boolean }[];
  getPlanEntriesForCourtAndDay: (courtId: string, dayOfWeek: number) => PlanEntry[];
  visibleSessions: Session[];
  sessions: Session[];
  courtClosures: CourtClosure[];
  isMobile: boolean;
  /** Ausgeblendeter Tages-Mini-Header, wenn innerhalb der mobilen Wochen-Pills eingebettet */
  embedded?: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  goToPrevious: () => void;
  goToNext: () => void;
  handleRemoveClosure: (closureId: string) => void;
  handleBookSlot: (courtId: string, date: Date, timeSlot: string) => void;
  openBlockDialog: (courtId: string, date: Date, timeSlot: string) => void;
  handleUnblockSlot: (sessionId: string) => void;
  handleCancelBooking: (sessionId: string, bookingId: string) => void;
  handleOpenCancelSession: (session: Session) => void;
  openAdHocDialog: (courtId: string, date: Date, timeSlot: string) => void;
}

export function DayView({
  targetDate,
  activeDragId,
  displayCourts,
  getPlanEntriesForCourtAndDay,
  visibleSessions,
  sessions,
  courtClosures,
  isMobile,
  embedded,
  isAdmin,
  isTrainer,
  goToPrevious,
  goToNext,
  handleRemoveClosure,
  handleBookSlot,
  openBlockDialog,
  handleUnblockSlot,
  handleCancelBooking,
  handleOpenCancelSession,
  openAdHocDialog,
}: DayViewProps) {
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
      {!embedded && (
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-primary/[0.04] to-transparent border-b border-border/40">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goToPrevious}
                aria-label="Vorheriger Tag"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vorheriger Tag</TooltipContent>
          </Tooltip>
          <div className="text-center flex-1 min-w-0">
            <span className={`font-bold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
              {format(targetDate, 'EEEE', { locale: de })}
            </span>
            <span className={`text-muted-foreground ${isMobile ? 'text-xs ml-1' : 'text-sm ml-2'}`}>
              {format(targetDate, isMobile ? 'dd.MM.' : 'dd. MMMM yyyy', { locale: de })}
            </span>
            {isSameDay(targetDate, new Date()) && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-2xs font-bold">
                Heute
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goToNext}
                aria-label="Nächster Tag"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nächster Tag</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Time-axis grid */}
      <div className="overflow-auto max-h-[70vh]">
        <div style={{ minWidth: gridMinW }}>
          {/* Court headers */}
          <div
            className="grid border-b border-border/40 sticky top-0 z-30 bg-card"
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
                    const clippedStart = rangeStart > dayWindowStart ? rangeStart : dayWindowStart;
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
                      const pos = getBlockPosition(entry.start_time, entry.end_time, gridStartHour);
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
