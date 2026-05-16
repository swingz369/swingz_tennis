'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  User,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';
import { useCourts } from '@/hooks/use-courts';

export default function MemberCourtBookings() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: clubData } = useUserClub();
  useUserMember();

  const clubId = clubData?.clubId ?? null;

  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(clubId);
  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);

  const memberSessions = useMemo(() => {
    return sessions.filter((s: Session) => s.bookedByUser);
  }, [sessions]);

  const getMonthBookings = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return memberSessions
      .filter((session: Session): session is Session & { week: string } => {
        return (
          !!session.week &&
          isWithinInterval(new Date(session.week), { start: monthStart, end: monthEnd })
        );
      })
      .map((session: Session & { week: string }) => {
        const court = courts.find((c) => c.id === session.courtId);
        return {
          ...session,
          courtName: court?.name || 'Unbekannter Platz',
          courtSurface: court?.surface || 'hard',
        };
      })
      .sort((a: Session & { week: string }, b: Session & { week: string }) => {
        const dateA = new Date(a.week);
        const dateB = new Date(b.week);
        return dateA.getTime() - dateB.getTime();
      });
  };

  const monthBookings = getMonthBookings();

  const getUpcomingBookings = () => {
    const now = new Date();
    return monthBookings
      .filter((booking: Session & { week: string }) => {
        const bookingDate = new Date(booking.week);
        return bookingDate >= now;
      })
      .slice(0, 5);
  };

  const upcomingBookings = getUpcomingBookings();

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getBookingStatus = (booking: any) => {
    const now = new Date();
    const bookingDate = new Date(booking.week);

    if (booking.bookingStatus === 'cancelled') {
      return { label: 'Storniert', color: 'bg-red-100 text-red-700', icon: XCircle };
    }

    if (bookingDate < now) {
      if (booking.bookingStatus === 'completed') {
        return { label: 'Abgeschlossen', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      }
      if (booking.bookingStatus === 'no_show') {
        return { label: 'Nicht erschienen', color: 'bg-gray-100 text-gray-700', icon: XCircle };
      }
      return { label: 'Vergangen', color: 'bg-gray-100 text-gray-700', icon: Clock };
    }

    if (booking.bookingStatus === 'confirmed') {
      return { label: 'Bestätigt', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
    }

    return { label: 'Ausstehend', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  };

  const getSurfaceLabel = (surface: string) => {
    const labels: Record<string, string> = {
      clay: 'Sand',
      grass: 'Rasen',
      hard: 'Hartplatz',
      carpet: 'Teppich',
    };
    return labels[surface] || surface;
  };

  if (sessionsLoading || courtsLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Meine Platzbuchungen</h1>
          <p className="text-gray-500">Übersicht deiner gebuchten Tennisplätze</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center font-medium text-sm md:text-base">
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Diesen Monat</CardTitle>
            <Calendar className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthBookings.length}</div>
            <p className="text-xs text-gray-500 mt-1">Platzbuchungen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Kommende</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                monthBookings.filter((b: Session & { week: string }) => {
                  const bookingDate = new Date(b.week);
                  return bookingDate >= new Date();
                }).length
              }
            </div>
            <p className="text-xs text-gray-500 mt-1">noch bevorstehend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Verschiedene Plätze</CardTitle>
            <MapPin className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(monthBookings.map((b: Session & { courtId: string }) => b.courtId)).size}
            </div>
            <p className="text-xs text-gray-500 mt-1">unterschiedliche Plätze</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nächste Buchungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBookings.map(
                (booking: Session & { week: string; courtName: string; courtSurface: string }) => {
                  const status = getBookingStatus(booking);
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-primary/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-brand-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            {format(new Date(booking.week), 'EEEE, dd. MMMM yyyy', { locale: de })}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {booking.startTime} - {booking.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{booking.courtName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{booking.trainerName || 'Trainer'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Buchungen {format(currentMonth, 'MMMM yyyy', { locale: de })}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Keine Platzbuchungen für diesen Monat
            </div>
          ) : (
            <div className="space-y-2">
              {monthBookings.map(
                (booking: Session & { week: string; courtName: string; courtSurface: string }) => {
                  const status = getBookingStatus(booking);
                  const StatusIcon = status.icon;
                  const isToday = isSameDay(new Date(booking.week), new Date());

                  return (
                    <div
                      key={booking.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        isToday
                          ? 'bg-brand-primary/10 border-brand-primary/30'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-lg ${
                            isToday ? 'bg-brand-primary/20' : 'bg-gray-100'
                          }`}
                        >
                          <Calendar
                            className={`h-5 w-5 ${isToday ? 'text-brand-primary' : 'text-gray-600'}`}
                          />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-semibold ${
                              isToday ? 'text-brand-primary' : 'text-gray-900'
                            }`}
                          >
                            {format(new Date(booking.week), 'EEEE, dd. MMMM', { locale: de })}
                            {isToday && (
                              <span className="ml-2 text-xs bg-brand-primary text-white px-2 py-0.5 rounded-full">
                                Heute
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-1">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {booking.startTime} - {booking.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{booking.courtName}</span>
                              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                                {getSurfaceLabel(booking.courtSurface)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{booking.trainerName || 'Trainer'}</span>
                            </div>
                            {booking.notes && (
                              <div className="text-xs italic text-gray-500">{booking.notes}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Court Usage Summary */}
      {monthBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Platznutzung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(
                new Set(monthBookings.map((b: Session & { courtId: string }) => b.courtId))
              ).map((courtId) => {
                const courtBookings = monthBookings.filter(
                  (b: Session & { courtId: string }) => b.courtId === courtId
                );
                const court = courts.find((c) => c.id === courtId);

                return (
                  <div
                    key={courtId as string}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        <MapPin className="h-4 w-4 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{court?.name || 'Unbekannt'}</div>
                        <div className="text-sm text-gray-600">
                          {getSurfaceLabel(court?.surface || 'hard')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{courtBookings.length}x</div>
                      <div className="text-xs text-gray-600">gebucht</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
