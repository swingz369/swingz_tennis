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
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, MapPin } from 'lucide-react';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';
import { RsvpSection } from '@/components/rsvp-section';

export default function MemberTrainingSchedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: clubData } = useUserClub();
  useUserMember();

  const clubId = clubData?.clubId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const memberSessions = useMemo(() => {
    return sessions.filter((s: Session) => s.bookedByUser);
  }, [sessions]);

  // Helper to get session date (prefer timeslotStart)
  const getSessionDate = (session: any): Date => {
    const ts = session.timeslotStart || session.timeslot_start;
    if (ts) return new Date(ts);
    return new Date(0);
  };

  const getMonthSessions = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return memberSessions
      .filter((session: any) => {
        const sessionDate = getSessionDate(session);
        return isWithinInterval(sessionDate, { start: monthStart, end: monthEnd });
      })
      .sort((a: any, b: any) => {
        return getSessionDate(a).getTime() - getSessionDate(b).getTime();
      });
  };

  const monthSessions = getMonthSessions();

  const getUpcomingSessions = () => {
    const now = new Date();
    return memberSessions
      .filter((session: any) => {
        return getSessionDate(session) >= now;
      })
      .sort((a: any, b: any) => {
        return getSessionDate(a).getTime() - getSessionDate(b).getTime();
      })
      .slice(0, 5);
  };

  const upcomingSessions = getUpcomingSessions();

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getSessionStatus = (session: any) => {
    const now = new Date();
    const sessionDate = getSessionDate(session);

    if (session.bookingStatus === 'cancelled') {
      return { label: 'Storniert', color: 'bg-red-100 text-red-700' };
    }

    if (sessionDate < now) {
      if (session.bookingStatus === 'confirmed') {
        return { label: 'Abgeschlossen', color: 'bg-green-100 text-green-700' };
      }
      if (session.bookingStatus === 'no_show') {
        return { label: 'Nicht erschienen', color: 'bg-muted text-foreground' };
      }
      return { label: 'Vergangen', color: 'bg-muted text-foreground' };
    }

    if (session.bookingStatus === 'confirmed') {
      return { label: 'Bestätigt', color: 'bg-blue-100 text-blue-700' };
    }

    return { label: 'Ausstehend', color: 'bg-yellow-100 text-yellow-700' };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Meine Trainingszeiten</h1>
          <p className="text-muted-foreground">Übersicht deiner gebuchten Trainingssessions</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Diesen Monat
            </CardTitle>
            <Calendar className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Sessions gebucht</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kommende</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                monthSessions.filter((s: any) => {
                  return getSessionDate(s) >= new Date();
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">noch bevorstehend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Abgeschlossen
            </CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                monthSessions.filter((s: any) => {
                  return getSessionDate(s) < new Date() && s.bookingStatus === 'confirmed';
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">erfolgreich absolviert</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nächste Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingSessions.map((session: any) => {
                const status = getSessionStatus(session);
                return (
                  <div
                    key={session.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-primary/10 rounded-lg">
                        <Calendar className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">
                          {format(getSessionDate(session), 'EEEE, dd. MMMM yyyy', { locale: de })}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {session.startTime} - {session.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{session.trainerName || 'Trainer'}</span>
                          </div>
                        </div>
                        {/* RSVP Section */}
                        <div className="mt-2">
                          <RsvpSection
                            sessionId={session.id}
                            sessionDate={getSessionDate(session)}
                            startTime={session.startTime}
                            endTime={session.endTime}
                            courtName={session.courtName}
                            trainerName={session.trainerName}
                            currentStatus={session.rsvpStatus}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}
                    >
                      {status.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Trainingsplan {format(currentMonth, 'MMMM yyyy', { locale: de })}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Trainings für diesen Monat gebucht
            </div>
          ) : (
            <div className="space-y-2">
              {monthSessions.map((session: any) => {
                const status = getSessionStatus(session);
                const isToday = isSameDay(getSessionDate(session), new Date());

                return (
                  <div
                    key={session.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border transition-colors ${
                      isToday
                        ? 'bg-brand-primary/10 border-brand-primary/30'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-lg ${isToday ? 'bg-brand-primary/20' : 'bg-muted'}`}
                      >
                        <Calendar
                          className={`h-5 w-5 ${isToday ? 'text-brand-primary' : 'text-muted-foreground'}`}
                        />
                      </div>
                      <div>
                        <div
                          className={`font-semibold ${
                            isToday ? 'text-brand-primary' : 'text-foreground'
                          }`}
                        >
                          {format(getSessionDate(session), 'EEEE, dd. MMMM', { locale: de })}
                          {isToday && (
                            <span className="ml-2 text-xs bg-brand-primary text-white px-2 py-0.5 rounded-full">
                              Heute
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {session.startTime} - {session.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{session.trainerName || 'Trainer'}</span>
                          </div>
                          {session.notes && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{session.notes}</span>
                            </div>
                          )}
                        </div>
                        {/* RSVP Section */}
                        <div className="mt-2">
                          <RsvpSection
                            sessionId={session.id}
                            sessionDate={getSessionDate(session)}
                            startTime={session.startTime}
                            endTime={session.endTime}
                            courtName={session.courtName}
                            trainerName={session.trainerName}
                            currentStatus={session.rsvpStatus}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}
                    >
                      {status.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
