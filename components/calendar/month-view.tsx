'use client';

/**
 * Monatsansicht des Platzkalenders — 7-Spalten-Monatsraster + CSV-Export.
 * Übernommen aus app/(protected)/bookings/page.tsx (Sanierungsplan Phase 2.1):
 * dieselben `sessions`, dieselben Buchungs-Mutationen wie die anderen
 * Kalender-Ansichten, nur als Monatsraster statt Woche/Tag/Agenda dargestellt.
 */
import { useState } from 'react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isPast,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
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

  const openFeedbackModal = (session: Session, date: Date) => {
    const sessionDateTime = new Date(date);
    const [hours, minutes] = session.endTime.split(':');
    sessionDateTime.setHours(parseInt(hours), parseInt(minutes));
    if (isPast(sessionDateTime)) {
      setFeedbackModal({
        open: true,
        sessionId: session.id,
        trainerId: session.trainerId,
        trainerName: session.trainerName || 'Trainer',
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
            trainerId: s.trainerId,
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
          <div className="text-center py-12 text-muted-foreground">Laden…</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="grid grid-cols-7 gap-px bg-muted dark:bg-muted rounded-xl overflow-hidden min-w-[600px]">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                <div
                  key={day}
                  className="bg-muted dark:bg-muted p-2 md:p-3 text-center font-semibold text-foreground dark:text-foreground text-xs md:text-sm"
                >
                  {day}
                </div>
              ))}

              {calendarDays.map((day, idx) => {
                const daySessions = getSessionsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const dayOff = dayOffFor(day);

                return (
                  <div
                    key={idx}
                    className={`min-h-[5rem] md:min-h-[6.25rem] ${dayOff ? 'bg-warning-50' : 'bg-background dark:bg-card'} p-1 md:p-2 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
                      {format(day, 'd')}
                      {dayOff && (
                        <span className="ml-1 font-semibold text-warning-800">{dayOff.name}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-1 rounded text-xs transition-colors ${
                            session.bookedByUser
                              ? 'bg-error-50 text-error-800 border border-error-200'
                              : (session.currentBookings ?? 0) >= session.maxParticipants
                                ? 'bg-warning-50 text-warning-800'
                                : 'bg-info-50 text-info-800 hover:bg-info-100 cursor-pointer'
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
                            <span className="truncate">
                              {session.trainerName || session.trainerId}
                            </span>
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
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs bg-info-50 text-info-700 hover:bg-info-100 transition-colors"
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
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
