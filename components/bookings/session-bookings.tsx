'use client';

import { useState, useCallback } from 'react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportBookingsCSV } from '@/lib/csv-export';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
  useUpdateBookingStatus,
} from '@/hooks/use-sessions';

export function SessionBookings({ clubId: propClubId }: { clubId?: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();
  const { data: userRoles = [] } = useUserRoles();

  const clubId = propClubId ?? clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();

  const handleBooking = useCallback(
    (sessionId: string) => {
      if (!memberId || !clubId) {
        toast.error('Member-ID oder Club-ID nicht verfügbar');
        return;
      }
      createBooking.mutate({ memberId, sessionId, clubId });
    },
    [memberId, clubId, createBooking]
  );

  const handleCancelBooking = useCallback(
    (sessionId: string, bookingId: string) => {
      if (!clubId) return;
      cancelBooking.mutate({ bookingId, sessionId, clubId });
    },
    [clubId, cancelBooking]
  );

  const handleStatusChange = useCallback(
    (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'no_show') => {
      if (!clubId) return;
      updateBookingStatus.mutate({ bookingId, status: newStatus, clubId });
    },
    [clubId, updateBookingStatus]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSessionsForDay = (date: Date) => {
    const jsDay = date.getDay();
    const apiDay = jsDay === 0 ? 7 : jsDay;
    return sessions.filter((s: Session) => s.dayOfWeek === apiDay);
  };

  const getBookingStatusLabel = (status: string): string => {
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
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleExportCSV = () => {
    const data = sessions.map((s: Session) => ({
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Training Sessions</CardTitle>
            <CardDescription>Buche Trainingseinheiten mit deinem Trainer</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[100px] text-center font-medium text-sm">
              {format(currentMonth, 'MMM yyyy', { locale: de })}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Laden...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-px bg-muted dark:bg-muted rounded-lg overflow-hidden min-w-[600px]">
              {/* Day headers */}
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                <div
                  key={day}
                  className="bg-muted dark:bg-card p-2 md:p-3 text-center font-semibold text-xs md:text-sm"
                >
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day, idx) => {
                const daySessions = getSessionsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <div
                    key={idx}
                    className={`min-h-[5rem] md:min-h-[6.25rem] bg-background dark:bg-background p-1 md:p-2 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {daySessions.map((session: Session) => (
                        <div
                          key={session.id}
                          className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                            session.bookedByUser
                              ? 'bg-error-50 dark:bg-error-950 text-error-800 dark:text-error-200 border border-error-200 dark:border-error-800'
                              : 'bg-info-50 dark:bg-info-950 text-info-800 dark:text-info-200 hover:bg-info-100 dark:hover:bg-info-900'
                          }`}
                          role="button"
                          tabIndex={session.bookedByUser ? -1 : 0}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !session.bookedByUser) {
                              e.preventDefault();
                              handleBooking(session.id);
                            }
                          }}
                          onClick={() => !session.bookedByUser && handleBooking(session.id)}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-medium truncate">{session.startTime}</div>
                            {session.bookedByUser && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (session.bookingId) {
                                    handleCancelBooking(session.id, session.bookingId);
                                  }
                                }}
                                className="ml-1 p-0.5 rounded hover:bg-error-200 dark:hover:bg-error-800 transition-colors"
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
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium ${
                                  session.bookingStatus === 'confirmed'
                                    ? 'bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-200'
                                    : session.bookingStatus === 'cancelled'
                                      ? 'bg-error-100 dark:bg-error-900 text-error-700 dark:text-error-200'
                                      : session.bookingStatus === 'no_show'
                                        ? 'bg-muted dark:bg-muted text-foreground dark:text-gray-200'
                                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                                }`}
                              >
                                {getBookingStatusLabel(session.bookingStatus)}
                              </span>
                              {(userRoles.includes('admin') ||
                                userRoles.includes('superadmin') ||
                                userRoles.includes('trainer')) && (
                                <Select
                                  value={session.bookingStatus}
                                  onValueChange={(v) =>
                                    session.bookingId &&
                                    handleStatusChange(
                                      session.bookingId,
                                      v as 'pending' | 'confirmed' | 'cancelled' | 'no_show'
                                    )
                                  }
                                >
                                  <SelectTrigger
                                    className="h-6 text-2xs px-1 py-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
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
      </CardContent>
    </Card>
  );
}
