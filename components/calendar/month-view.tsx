'use client';

/**
 * Monatsansicht des Platzkalenders — 7-Spalten-Monatsraster + CSV-Export.
 * Übernommen aus app/(protected)/bookings/page.tsx (Sanierungsplan Phase 2.1):
 * dieselben `sessions`, dieselben Buchungs-Mutationen wie die anderen
 * Kalender-Ansichten, nur als Monatsraster statt Woche/Tag/Agenda dargestellt.
 */
import { useMemo, useState } from 'react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListState } from '@/components/ui/list-state';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Download, MessageSquare } from 'lucide-react';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import SessionWaitlistButton from '@/components/session-waitlist-button';
import FeedbackModal from '@/components/feedback/feedback-modal';
import { exportBookingsCSV } from '@/lib/csv-export';
import { toast } from 'sonner';
import type { Session } from '@/hooks/use-sessions';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  sessionLabel,
  summarizeSlot,
  type CalendarPlanEntry,
  type CourtClosure,
} from '@/lib/court-calendar-utils';
import type { DayOff } from '@/hooks/use-holidays';

function getBookingStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Bestätigt';
    case 'cancelled':
      return 'Storniert';
    case 'no_show':
      return 'Nicht erschienen';
    case 'pending':
      return 'Ausstehend';
    default:
      return status;
  }
}

export interface MonthViewProps {
  sessions: Session[];
  isLoading: boolean;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  memberId: string | null;
  clubId: string | null;
  dayOffFor: (date: Date) => DayOff | null;
  /** Für die Auslastung je Tag — dieselbe Zählung wie die Wochenübersicht. */
  courts: { id: string }[];
  closures: CourtClosure[];
  openingHours: unknown;
  getPlanEntries: (courtId: string, date: Date) => CalendarPlanEntry[];
  onOpenDay: (day: Date) => void;
  canManageStatus: boolean;
  onBookSession: (sessionId: string) => void;
  onCancelBooking: (sessionId: string, bookingId: string) => void;
  onStatusChange: (
    bookingId: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'no_show'
  ) => void;
}

export function MonthView({
  sessions,
  isLoading,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  memberId,
  clubId,
  dayOffFor,
  courts,
  closures,
  openingHours,
  getPlanEntries,
  onOpenDay,
  canManageStatus,
  onBookSession,
  onCancelBooking,
  onStatusChange,
}: MonthViewProps) {
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    sessionId: string;
    trainerId: string;
    trainerName: string;
    sessionTitle: string;
  }>({ open: false, sessionId: '', trainerId: '', trainerName: '', sessionTitle: '' });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSessionsForDay = (date: Date): Session[] => {
    const jsDay = date.getDay();
    const apiDay = jsDay === 0 ? 7 : jsDay;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    return sessions.filter((s) => {
      const ts = s.timeslotStart;
      if (ts) return String(ts).substring(0, 10) === dateStr;
      return s.dayOfWeek === apiDay;
    });
  };

  const [selectedDay, setSelectedDay] = useState<Date | null>(() =>
    isSameMonth(new Date(), currentMonth) ? new Date() : null
  );

  // Auslastung je Tag: Anteil belegter Platz-Stunden, gezählt wie im Buchungsraster.
  const dayStats = useMemo(
    () =>
      calendarDays.map((day) => {
        const daySessions = getSessionsForDay(day);
        const off = dayOffFor(day);
        let free = 0;
        for (const ts of TIME_SLOTS) {
          free += summarizeSlot(
            courts,
            day,
            ts,
            daySessions,
            getPlanEntries,
            closures,
            openingHours
          ).free;
        }
        const slots = courts.length * TIME_SLOTS.length;
        const trainingSessions = daySessions.filter((s) => s.sessionType === 'training').length;
        const planned = off ? 0 : courts.reduce((n, c) => n + getPlanEntries(c.id, day).length, 0);
        return {
          day,
          off,
          utilization: slots ? 1 - free / slots : 0,
          trainings: trainingSessions || planned,
          bookings: daySessions.filter(
            (s) => s.sessionType !== 'training' && (s.hasActiveBooking || s.bookedByUser)
          ).length,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMonth, sessions, courts, closures, openingHours, getPlanEntries, dayOffFor]
  );
  const selectedSessions = selectedDay ? getSessionsForDay(selectedDay) : [];

  const openFeedbackModal = (session: Session, date: Date) => {
    const sessionDateTime = new Date(date);
    const [hours, minutes] = session.endTime.split(':');
    sessionDateTime.setHours(parseInt(hours), parseInt(minutes));
    if (isPast(sessionDateTime) && session.trainerId) {
      setFeedbackModal({
        open: true,
        sessionId: session.id,
        trainerId: session.trainerId,
        trainerName: sessionLabel(session),
        sessionTitle: `${session.startTime} - ${session.endTime}`,
      });
    }
  };

  const handleExportCSV = () => {
    const data = sessions.map((s) => ({
      id: s.id,
      status: s.bookingStatus || 'n/a',
      bookedAt: new Date().toISOString(),
      session: s.bookedByUser
        ? {
            startTime: s.startTime,
            endTime: s.endTime,
            trainerId: s.trainerId ?? '',
            court: s.trainerName || '-',
          }
        : null,
      ...(memberId ? { memberId } : {}),
    }));
    exportBookingsCSV(data);
    toast.success('Buchungs-Export gestartet');
  };

  return (
    <div className="space-y-4">
      <CalendarShell
        title="Monatsansicht"
        subtitle="Trainingseinheiten und Platzbuchungen im Überblick"
        nav={{
          label: format(currentMonth, 'MMMM yyyy', { locale: de }),
          onPrev: onPrevMonth,
          onNext: onNextMonth,
          onToday,
        }}
        controls={
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      >
        {isLoading ? (
          <Skeleton className="h-[28rem] w-full rounded-xl" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                <div
                  key={day}
                  className="px-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground md:text-xs"
                >
                  {day}
                </div>
              ))}
              {dayStats.map(({ day, off, utilization, trainings, bookings }) => {
                const inMonth = isSameMonth(day, currentMonth);
                const selected = !!selectedDay && isSameDay(day, selectedDay);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={selected}
                    aria-label={`${format(day, 'EEEE, d. MMMM', { locale: de })}${off ? `, ${off.name}` : ''}: ${trainings} Trainings, ${bookings} Buchungen, ${Math.round(utilization * 100)} % belegt`}
                    className={cn(
                      'flex min-h-[4.5rem] min-w-0 flex-col gap-1 rounded-md border p-1.5 text-left transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[7rem] md:p-2.5',
                      off ? 'border-warning-200 bg-warning-50' : 'border-border bg-card',
                      selected && 'border-primary ring-1 ring-primary',
                      !inMonth && 'opacity-45'
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          'rounded px-1 text-xs font-bold tabular-nums md:text-sm',
                          isToday(day) && 'bg-highlight text-highlight-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {off && (
                        <span className="hidden truncate rounded bg-warning-100 px-1.5 text-2xs font-semibold text-warning-800 md:inline">
                          {off.name}
                        </span>
                      )}
                    </span>
                    <span className="flex-1" />
                    <span
                      className="block h-1.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(utilization * 100)}%` }}
                      />
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground md:block">
                      {off ? 'kein Training' : `${trainings} Trainings`}
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground md:block">
                      {bookings} Buchungen
                    </span>
                    <span className="hidden text-xs font-semibold tabular-nums md:block">
                      {Math.round((1 - utilization) * 100)} % frei
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-8 rounded-full bg-primary" aria-hidden="true" />
                Auslastung des Tages (alle Plätze)
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-4 rounded border border-warning-200 bg-warning-50"
                  aria-hidden="true"
                />
                Ferien/Feiertag – kein Training
              </span>
              <span className="md:ml-auto">Tag anklicken für die Termine</span>
            </div>

            {selectedDay && (
              <section
                aria-label={`Termine am ${format(selectedDay, 'd. MMMM', { locale: de })}`}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                  <h3 className="text-base font-semibold">
                    {format(selectedDay, 'EEEE, d. MMMM', { locale: de })}
                  </h3>
                  {dayOffFor(selectedDay) && (
                    <span className="rounded bg-warning-100 px-1.5 text-xs font-semibold text-warning-800">
                      {dayOffFor(selectedDay)?.name} · kein Training
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => onOpenDay(selectedDay)}
                  >
                    Tag öffnen
                  </Button>
                </div>
                <div className="p-3">
                  <ListState
                    empty={selectedSessions.length === 0}
                    emptyTitle="An diesem Tag ist nichts eingetragen"
                    emptyHint="Über „Tag öffnen“ lässt sich ein freier Platz buchen."
                  >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedSessions.map((session) => {
                        const day = selectedDay;
                        return (
                          <div
                            key={session.id}
                            className={`p-1 rounded text-xs transition-colors ${
                              session.bookedByUser
                                ? 'bg-error-50 text-error-800 border border-error-200'
                                : (session.currentBookings ?? 0) >= session.maxParticipants
                                  ? 'bg-warning-50 text-warning-800'
                                  : 'bg-muted text-foreground hover:bg-accent cursor-pointer'
                            }`}
                            role="button"
                            tabIndex={
                              session.bookedByUser ||
                              (session.currentBookings ?? 0) >= session.maxParticipants
                                ? -1
                                : 0
                            }
                            onKeyDown={(e) => {
                              if (
                                (e.key === 'Enter' || e.key === ' ') &&
                                !session.bookedByUser &&
                                (session.currentBookings ?? 0) < session.maxParticipants
                              ) {
                                e.preventDefault();
                                onBookSession(session.id);
                              }
                            }}
                            onClick={() =>
                              !session.bookedByUser &&
                              (session.currentBookings ?? 0) < session.maxParticipants &&
                              onBookSession(session.id)
                            }
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="font-medium truncate">{session.startTime}</div>
                              {session.bookedByUser && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (session.bookingId) {
                                      onCancelBooking(session.id, session.bookingId);
                                    }
                                  }}
                                  className="ml-1 p-0.5 rounded hover:bg-error-100 text-error-600 transition-colors"
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
                            <div className="flex items-center gap-1 text-2xs">
                              <Clock className="h-3 w-3" />
                              <span className="truncate">{sessionLabel(session)}</span>
                            </div>
                            {session.bookedByUser && session.bookingStatus && (
                              <div className="flex flex-col gap-1 mt-0.5">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium ${
                                      session.bookingStatus === 'confirmed'
                                        ? 'bg-success-100 text-success-700'
                                        : session.bookingStatus === 'cancelled'
                                          ? 'bg-error-100 text-error-700'
                                          : session.bookingStatus === 'no_show'
                                            ? 'bg-muted text-foreground'
                                            : 'bg-warning-100 text-warning-700'
                                    }`}
                                  >
                                    {getBookingStatusLabel(session.bookingStatus)}
                                  </span>
                                  {canManageStatus && (
                                    <Select
                                      value={session.bookingStatus}
                                      onValueChange={(v) =>
                                        session.bookingId &&
                                        onStatusChange(
                                          session.bookingId,
                                          v as 'pending' | 'confirmed' | 'cancelled' | 'no_show'
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-6 text-2xs px-1 py-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Ausstehend</SelectItem>
                                        <SelectItem value="confirmed">Bestätigt</SelectItem>
                                        <SelectItem value="cancelled">Storniert</SelectItem>
                                        <SelectItem value="no_show">Nicht erschienen</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                                {(() => {
                                  const sessionDateTime = new Date(day);
                                  const [hours, minutes] = session.endTime.split(':');
                                  sessionDateTime.setHours(parseInt(hours), parseInt(minutes));
                                  return (
                                    isPast(sessionDateTime) && session.bookingStatus === 'confirmed'
                                  );
                                })() && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFeedbackModal(session, day);
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs bg-muted text-foreground hover:bg-accent transition-colors"
                                    title="Feedback geben"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    Feedback
                                  </button>
                                )}
                              </div>
                            )}
                            {!session.bookedByUser &&
                              (session.currentBookings ?? 0) >= session.maxParticipants &&
                              clubId && (
                                <SessionWaitlistButton
                                  sessionId={session.id}
                                  clubId={clubId}
                                  currentBookings={session.currentBookings ?? 0}
                                  maxParticipants={session.maxParticipants}
                                  bookedByUser={!!session.bookedByUser}
                                />
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </ListState>
                </div>
              </section>
            )}
          </div>
        )}
      </CalendarShell>

      <FeedbackModal
        open={feedbackModal.open}
        onOpenChange={(open) => setFeedbackModal({ ...feedbackModal, open })}
        sessionId={feedbackModal.sessionId}
        trainerId={feedbackModal.trainerId}
        trainerName={feedbackModal.trainerName}
        sessionTitle={feedbackModal.sessionTitle}
      />
    </div>
  );
}
