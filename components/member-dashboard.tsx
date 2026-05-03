'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, isSameDay, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Trophy,
  TrendingUp,
  User,
  CreditCard,
  Bell,
  BookOpen,
  Target,
  ArrowRight,
} from 'lucide-react';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import { useSessions } from '@/hooks/use-sessions';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalBookings: number;
  upcomingSessions: number;
  completedSessions: number;
  attendanceRate: number;
}

export default function MemberDashboard() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const memberSessions = sessions.filter((s) => s.bookedByUser);

  const calculateStats = (): DashboardStats => {
    const now = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthSessions = memberSessions.filter((session) => {
      const sessionDate = new Date(session.week);
      return isWithinInterval(sessionDate, { start: monthStart, end: monthEnd });
    });

    const upcomingSessions = monthSessions.filter((session) => {
      const sessionDate = new Date(session.week);
      return sessionDate >= now;
    }).length;

    const completedSessions = monthSessions.filter((session) => {
      const sessionDate = new Date(session.week);
      return sessionDate < now && session.bookingStatus === 'completed';
    }).length;

    const totalBookings = monthSessions.length;
    const attendanceRate = totalBookings > 0
      ? Math.round((completedSessions / totalBookings) * 100)
      : 0;

    return {
      totalBookings,
      upcomingSessions,
      completedSessions,
      attendanceRate,
    };
  };

  const stats = calculateStats();

  const getNextSession = () => {
    const now = new Date();
    const upcoming = memberSessions
      .filter((s) => {
        const sessionDate = new Date(s.week);
        return sessionDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.week);
        const dateB = new Date(b.week);
        return dateA.getTime() - dateB.getTime();
      });

    return upcoming[0] || null;
  };

  const nextSession = getNextSession();

  const getRecentActivity = () => {
    const now = new Date();
    return memberSessions
      .filter((s) => {
        const sessionDate = new Date(s.week);
        return sessionDate < now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.week);
        const dateB = new Date(b.week);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  };

  const recentActivity = getRecentActivity();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-primary mb-2">
          Willkommen zurück!
        </h1>
        <p className="text-gray-600">
          Hier ist dein Überblick für {format(currentMonth, 'MMMM yyyy', { locale: de })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Gesamt Buchungen
            </CardTitle>
            <Calendar className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-gray-500 mt-1">
              diesen Monat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Kommende Sessions
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingSessions}</div>
            <p className="text-xs text-gray-500 mt-1">
              geplant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Abgeschlossen
            </CardTitle>
            <Trophy className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedSessions}</div>
            <p className="text-xs text-gray-500 mt-1">
              Trainings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Anwesenheitsrate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              dieses Monat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Session Card */}
      {nextSession && (
        <Card className="bg-gradient-to-r from-brand-primary/10 to-blue-50 border-brand-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-primary" />
              Nächste Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">
                  {format(new Date(nextSession.week), 'EEEE, dd. MMMM', { locale: de })}
                </div>
                <div className="text-gray-600">
                  {nextSession.startTime} - {nextSession.endTime} Uhr
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  mit {nextSession.trainerName || 'Trainer'}
                </div>
              </div>
              <Button
                onClick={() => router.push('/bookings')}
                className="gap-2"
              >
                Details anzeigen
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/bookings')}
            >
              <Calendar className="h-6 w-6" />
              <span className="font-medium">Buchungen verwalten</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/courts')}
            >
              <BookOpen className="h-6 w-6" />
              <span className="font-medium">Platzkalender</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/billing')}
            >
              <CreditCard className="h-6 w-6" />
              <span className="font-medium">Rechnungen</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/profile')}
            >
              <User className="h-6 w-6" />
              <span className="font-medium">Profil bearbeiten</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/notifications')}
            >
              <Bell className="h-6 w-6" />
              <span className="font-medium">Benachrichtigungen</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => router.push('/progress')}
            >
              <Target className="h-6 w-6" />
              <span className="font-medium">Fortschritt</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kürzliche Aktivität</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-brand-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {format(new Date(session.week), 'dd. MMMM', { locale: de })}
                      </div>
                      <div className="text-sm text-gray-600">
                        {session.startTime} - {session.endTime} mit {session.trainerName || 'Trainer'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        session.bookingStatus === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : session.bookingStatus === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {session.bookingStatus === 'completed'
                        ? 'Abgeschlossen'
                        : session.bookingStatus === 'cancelled'
                          ? 'Storniert'
                          : 'Ausstehend'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}