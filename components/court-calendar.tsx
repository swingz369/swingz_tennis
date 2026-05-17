'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import { useCourts } from '@/hooks/use-courts';
import type { Session } from '@/hooks/use-sessions';
import { useSessions, useCreateBooking, useCancelBooking } from '@/hooks/use-sessions';
import { exportSessionsToICS, exportSessionToGoogleCalendar } from '@/lib/calendar-export';
import { CALENDAR_TIME_SLOTS as TIME_SLOTS } from '@/lib/court-calendar-utils';
import {
  CourtCalendarHeader,
  CourtCalendarGrid,
  WeekDaysHeaderRow,
  CourtRowHeader,
  CourtCalendarLegend,
} from '@/components/court-calendar-shared';

interface CourtCalendarProps {
  onBookCourt?: (courtId: string, date: Date, startTime: string, endTime: string) => void;
}

const MEMBER_LEGEND_ITEMS = [
  { label: 'Verfügbar', className: 'bg-green-50 border border-green-200' },
  { label: 'Belegt', className: 'bg-gray-100 border border-gray-200' },
  { label: 'Deine Buchung', className: 'bg-red-50 border border-red-200' },
];

export default function CourtCalendar({ onBookCourt }: CourtCalendarProps) {
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  const handleExportICS = useCallback(() => {
    try {
      exportSessionsToICS(sessions, courts);
      toast.success('ICS-Export erfolgreich');
    } catch (error) {
      toast.error('ICS-Export fehlgeschlagen');
      console.error('ICS export error:', error);
    }
  }, [sessions, courts]);

  const handleExportGoogleCalendar = useCallback(() => {
    if (sessions.length === 0) {
      toast.error('Keine Sessions zum Exportieren');
      return;
    }

    const firstSession = sessions[0];
    const court = courts.find((c) => c.id === firstSession.courtId);
    try {
      exportSessionToGoogleCalendar(firstSession, court?.name);
      toast.success('Google Calendar geöffnet');
    } catch (error) {
      toast.error('Google Calendar Export fehlgeschlagen');
      console.error('Google Calendar export error:', error);
    }
  }, [sessions, courts]);

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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CourtCalendarHeader
        title="Platz-Kalender"
        subtitle="Wochenansicht der Platzverfügbarkeit"
        weekStart={weekStart}
        weekEnd={weekEnd}
        onGoPrevious={goToPreviousWeek}
        onGoNext={goToNextWeek}
        onGoToday={goToToday}
        onGoDaily={() => router.push('/courts/daily')}
      >
        <Button variant="outline" size="sm" onClick={handleExportICS}>
          <Download className="h-4 w-4 mr-2" />
          ICS Export
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportGoogleCalendar}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Google Calendar
        </Button>
      </CourtCalendarHeader>

      <CourtCalendarGrid>
        <WeekDaysHeaderRow weekDays={weekDays} />

        {courts.map((court) => (
          <div key={court.id} className="border-b border-gray-200 last:border-b-0">
            <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-gray-100">
              <CourtRowHeader court={court} />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-1 min-h-[300px] bg-white ${
                    isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="space-y-0.5">
                    {TIME_SLOTS.map((timeSlot) => {
                      const session = getSessionForCourtAndTime(court.id, day, timeSlot);
                      const isAvailable = !session;

                      return (
                        <div
                          key={timeSlot}
                          className={`h-6 rounded text-[11px] flex items-center justify-center cursor-pointer transition-colors ${
                            isAvailable
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              : session?.bookedByUser
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                          onClick={() => isAvailable && handleBookSlot(court.id, day, timeSlot)}
                        >
                          {session ? (
                            <div className="flex items-center gap-1 w-full justify-between px-1">
                              <span className="truncate">
                                {session.trainerName?.substring(0, 8) || 'Trainer'}
                              </span>
                              {session.bookedByUser && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (session.bookingId) {
                                      handleCancelBooking(session.id, session.bookingId);
                                    }
                                  }}
                                  className="p-0.5 rounded hover:bg-red-100 text-red-600"
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
                          ) : (
                            <span className="text-[11px]">{timeSlot}</span>
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
      </CourtCalendarGrid>

      <CourtCalendarLegend items={MEMBER_LEGEND_ITEMS} />
    </div>
  );
}
