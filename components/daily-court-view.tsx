'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays, isSameDay, setHours, setMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, User, MapPin, Calendar as CalendarIcon, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import { useCourts } from '@/hooks/use-courts';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
} from '@/hooks/use-sessions';
import { exportSessionsToICS, exportSessionToGoogleCalendar } from '@/lib/calendar-export';

interface DailyCourtViewProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
];

export default function DailyCourtView({ selectedDate: initialDate, onDateChange }: DailyCourtViewProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  const goToPreviousDay = () => {
    const newDate = subDays(selectedDate, 1);
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  const goToNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  const goToToday = () => {
    const newDate = new Date();
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

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

    // Export first session to Google Calendar
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

  const getSessionForCourtAndTime = useCallback((
    courtId: string,
    date: Date,
    timeSlot: string
  ) => {
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
        ((slotStart.getTime() >= sessionStart.getTime() && slotStart.getTime() < sessionEnd.getTime()) ||
         (slotEnd.getTime() > sessionStart.getTime() && slotEnd.getTime() <= sessionEnd.getTime()) ||
         (slotStart.getTime() <= sessionStart.getTime() && slotEnd.getTime() >= sessionEnd.getTime()))
      );
    });
  }, [sessions]);

  const handleBookSlot = useCallback((
    courtId: string,
    date: Date,
    timeSlot: string
  ) => {
    if (!memberId || !clubId) {
      toast.error('Member-ID oder Club-ID nicht verfügbar');
      return;
    }

    const session = getSessionForCourtAndTime(courtId, date, timeSlot);
    if (session) {
      createBooking.mutate({ memberId, sessionId: session.id, clubId });
    } else {
      toast.error('Keine Session für diesen Zeitplatz gefunden');
    }
  }, [memberId, clubId, createBooking, getSessionForCourtAndTime]);

  const handleCancelBooking = useCallback((
    sessionId: string,
    bookingId: string
  ) => {
    if (!clubId) return;
    cancelBooking.mutate({ bookingId, sessionId, clubId });
  }, [clubId, cancelBooking]);

  const getSurfaceLabel = (surface: string) => {
    const labels: Record<string, string> = {
      clay: 'Sand',
      grass: 'Rasen',
      hard: 'Hartplatz',
      carpet: 'Teppich',
    };
    return labels[surface] || surface;
  };

  const getBookingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      confirmed: 'Bestätigt',
      cancelled: 'Storniert',
      no_show: 'Nicht erschienen',
      pending: 'Ausstehend',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      no_show: 'bg-gray-100 text-gray-700 border-gray-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Tagesansicht</h1>
          <p className="text-gray-500">Detaillierte Platzübersicht für den ausgewählten Tag</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/courts')}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Wochenansicht
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportICS}>
            <Download className="h-4 w-4 mr-2" />
            ICS Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportGoogleCalendar}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Google Calendar
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center font-medium text-sm md:text-base">
            {format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Daily Grid */}
      <div className="space-y-4">
        {courts.map((court) => (
          <div key={court.id} className="border rounded-lg overflow-hidden">
            {/* Court Header */}
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-primary/10 rounded-lg">
                    <MapPin className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{court.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{getSurfaceLabel(court.surface)}</span>
                      {court.hasIndoor && <span>• Indoor</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {sessions.filter(s => s.courtId === court.id).length} Buchungen
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="divide-y">
              {TIME_SLOTS.map((timeSlot) => {
                const session = getSessionForCourtAndTime(court.id, selectedDate, timeSlot);
                const isAvailable = !session;

                return (
                  <div
                    key={timeSlot}
                    className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      isAvailable ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => isAvailable && handleBookSlot(court.id, selectedDate, timeSlot)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center">
                        <div className="font-medium text-sm">{timeSlot}</div>
                        <div className="text-xs text-gray-500">
                          {format(
                            new Date(selectedDate.setHours(
                              parseInt(timeSlot.split(':')[0]),
                              parseInt(timeSlot.split(':')[1])
                            )),
                            'HH:mm'
                          )}
                        </div>
                      </div>

                      {session ? (
                        <div className="flex-1">
                          <div className={`p-3 rounded-lg border ${
                            session.bookedByUser
                              ? 'bg-red-50 border-red-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="h-4 w-4 text-gray-600" />
                                  <span className="font-medium">
                                    {session.trainerName || 'Trainer'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{session.startTime} - {session.endTime}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    <span>Max. {session.maxParticipants} Teilnehmer</span>
                                  </div>
                                </div>
                                {session.notes && (
                                  <div className="mt-2 text-sm text-gray-600 italic">
                                    {session.notes}
                                  </div>
                                )}
                                {session.bookedByUser && session.bookingStatus && (
                                  <div className="mt-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.bookingStatus)}`}
                                    >
                                      {getBookingStatusLabel(session.bookingStatus)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {session.bookedByUser && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (session.bookingId) {
                                      handleCancelBooking(session.id, session.bookingId);
                                    }
                                  }}
                                  className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                                  title="Buchung stornieren"
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
                      ) : (
                        <div className="flex-1">
                          <div className="p-3 rounded-lg border border-dashed border-gray-300 bg-green-50/50">
                            <div className="flex items-center gap-2 text-green-700">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm">Verfügbar</span>
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
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-dashed border-gray-300 rounded"></div>
          <span>Verfügbar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
          <span>Belegt</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
          <span>Deine Buchung</span>
        </div>
      </div>
    </div>
  );
}