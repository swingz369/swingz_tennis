'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
  ChevronRight,
} from 'lucide-react';
import { useUserClub } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
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
  const [currentMonth] = useState(new Date());

  const { data: clubData } = useUserClub();

  const clubId = clubData?.clubId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const memberSessions = sessions.filter((s: Session) => s.bookedByUser);

  const calculateStats = (): DashboardStats => {
    const now = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthSessions = memberSessions.filter(
      (session: Session): session is Session & { week: string } => {
        return (
          !!session.week &&
          isWithinInterval(new Date(session.week), { start: monthStart, end: monthEnd })
        );
      }
    );

    const upcomingSessions = monthSessions.filter((session: Session) => {
      if (!session.week) return false;
      const sessionDate = new Date(session.week);
      return sessionDate >= now;
    }).length;

    const completedSessions = monthSessions.filter((session: Session) => {
      if (!session.week) return false;
      const sessionDate = new Date(session.week);
      return sessionDate < now && session.bookingStatus === 'confirmed';
    }).length;

    const totalBookings = monthSessions.length;
    const attendanceRate =
      totalBookings > 0 ? Math.round((completedSessions / totalBookings) * 100) : 0;

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
      .filter((s: Session) => {
        if (!s.week) return false;
        const sessionDate = new Date(s.week);
        return sessionDate >= now;
      })
      .sort((a: Session, b: Session) => {
        if (!a.week || !b.week) return 0;
        const dateA = new Date(a.week);
        const dateB = new Date(b.week);
        return dateA.getTime() - dateB.getTime();
      });

    return upcoming[0] || null;
  };

  const getRecentActivity = () => {
    const now = new Date();
    return memberSessions
      .filter((s: Session) => {
        if (!s.week) return false;
        const sessionDate = new Date(s.week);
        return sessionDate < now;
      })
      .sort((a: Session, b: Session) => {
        if (!a.week || !b.week) return 0;
        const dateA = new Date(a.week);
        const dateB = new Date(b.week);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  };

  const nextSession = getNextSession();

  const recentActivity = getRecentActivity();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Willkommen zurück!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Dein Überblick für {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </p>
        </div>
        <Button variant="accent" onClick={() => router.push('/bookings')}>
          Neue Buchung
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Gesamt Buchungen',
            value: stats.totalBookings,
            icon: Calendar,
            color: 'bg-gradient-to-br from-brand-light to-brand-primary',
            sublabel: 'diesen Monat',
          },
          {
            label: 'Kommende Sessions',
            value: stats.upcomingSessions,
            icon: Clock,
            color: 'from-blue-500 to-brand-secondary',
            sublabel: 'geplant',
          },
          {
            label: 'Abgeschlossen',
            value: stats.completedSessions,
            icon: Trophy,
            color: 'from-green-500 to-green-700',
            sublabel: 'Trainings',
          },
          {
            label: 'Anwesenheitsrate',
            value: `${stats.attendanceRate}%`,
            icon: TrendingUp,
            color: 'from-brand-accent to-orange-700',
            sublabel: 'dieses Monat',
          },
        ].map((stat, idx) => (
          <Card key={idx} variant="default" className="group overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.sublabel}</p>
                </div>
                <div
                  className={`h-12 w-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {nextSession && (
        <Card variant="gradient" className="overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-light/10 via-transparent to-brand-accent/5" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center text-white shadow-lg">
                  <Calendar className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nächste Session
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {format(new Date(nextSession.week), 'EEEE, dd. MMMM', { locale: de })}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {nextSession.startTime} - {nextSession.endTime} Uhr mit{' '}
                    {nextSession.trainerName || 'Trainer'}
                  </p>
                </div>
              </div>
              <Button onClick={() => router.push('/bookings')} className="gap-2">
                Details
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="default" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Calendar, label: 'Buchungen', href: '/bookings' },
                { icon: BookOpen, label: 'Platzkalender', href: '/courts' },
                { icon: CreditCard, label: 'Rechnungen', href: '/billing' },
                { icon: User, label: 'Profil', href: '/profile' },
                { icon: Bell, label: 'Benachrichtigungen', href: '/notifications' },
                { icon: Target, label: 'Fortschritt', href: '/progress' },
              ].map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center gap-3 rounded-xl hover:border-brand-light hover:text-brand-light"
                  onClick={() => router.push(action.href)}
                >
                  <action.icon className="h-6 w-6" />
                  <span className="font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {recentActivity.length > 0 && (
          <Card variant="default">
            <CardHeader>
              <CardTitle>Kürzliche Aktivität</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((session: Session & { week: string }) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-brand-light/20 to-brand-primary/20 rounded-lg">
                        <Calendar className="h-4 w-4 text-brand-light" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {format(new Date(session.week), 'dd. MMMM', { locale: de })}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                        session.bookingStatus === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-700/20 dark:text-green-700'
                          : session.bookingStatus === 'cancelled'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                      }`}
                    >
                      {session.bookingStatus === 'confirmed'
                        ? 'Abgeschlossen'
                        : session.bookingStatus === 'cancelled'
                          ? 'Storniert'
                          : 'Ausstehend'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
