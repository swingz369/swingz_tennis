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
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';

interface AttendanceRecord {
  date: Date;
  status: 'attended' | 'missed' | 'cancelled' | 'upcoming';
  session: Session;
}

export default function MemberAttendanceHistory() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const { data: clubData } = useUserClub();
  useUserMember();

  const clubId = clubData?.clubId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const memberSessions = useMemo(() => {
    return sessions.filter((s: Session) => s.bookedByUser);
  }, [sessions]);

  const getAttendanceRecords = (): AttendanceRecord[] => {
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
        const sessionDate = new Date(session.week);
        const now = new Date();

        let status: AttendanceRecord['status'] = 'upcoming';

        if (sessionDate < now) {
          if (session.bookingStatus === 'confirmed') {
            status = 'attended';
          } else if (session.bookingStatus === 'cancelled') {
            status = 'cancelled';
          } else if (session.bookingStatus === 'no_show') {
            status = 'missed';
          } else {
            status = 'missed';
          }
        }

        return {
          date: sessionDate,
          status,
          session,
        };
      })
      .sort((a: AttendanceRecord, b: AttendanceRecord) => a.date.getTime() - b.date.getTime());
  };

  const attendanceRecords = getAttendanceRecords();

  const getAttendanceStats = () => {
    const total = attendanceRecords.length;
    const attended = attendanceRecords.filter(
      (r: AttendanceRecord) => r.status === 'attended'
    ).length;
    const missed = attendanceRecords.filter((r: AttendanceRecord) => r.status === 'missed').length;
    const cancelled = attendanceRecords.filter(
      (r: AttendanceRecord) => r.status === 'cancelled'
    ).length;
    const upcoming = attendanceRecords.filter(
      (r: AttendanceRecord) => r.status === 'upcoming'
    ).length;

    const attendanceRate = total > 0 ? Math.round((attended / (total - upcoming)) * 100) : 0;

    return {
      total,
      attended,
      missed,
      cancelled,
      upcoming,
      attendanceRate,
    };
  };

  const stats = getAttendanceStats();

  const getStreak = () => {
    const attendedRecords = attendanceRecords
      .filter((r: AttendanceRecord) => r.status === 'attended')
      .sort((a: AttendanceRecord, b: AttendanceRecord) => b.date.getTime() - a.date.getTime());

    if (attendedRecords.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const record of attendedRecords) {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 7) {
        streak++;
        currentDate = recordDate;
      } else {
        break;
      }
    }

    return streak;
  };

  const currentStreak = getStreak();

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'attended':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled':
        return <Clock className="h-4 w-4 text-gray-600" />;
      case 'upcoming':
        return <Calendar className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusLabel = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'attended':
        return 'Teilgenommen';
      case 'missed':
        return 'Nicht erschienen';
      case 'cancelled':
        return 'Storniert';
      case 'upcoming':
        return 'Bevorstehend';
    }
  };

  const getStatusColor = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'attended':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'missed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const calendarDays = getCalendarDays();

  const getAttendanceForDay = (date: Date) => {
    return attendanceRecords.find((record) => isSameDay(record.date, date));
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Anwesenheitshistorie</h1>
          <p className="text-gray-500">Verfolgung deiner Trainingsanwesenheit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            Kalender
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            Liste
          </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Anwesenheitsrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.attended} von {stats.total - stats.upcoming} absolviert
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Aktuelle Serie</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStreak}</div>
            <p className="text-xs text-gray-500 mt-1">aufeinanderfolgende Trainings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teilgenommen</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attended}</div>
            <p className="text-xs text-gray-500 mt-1">erfolgreiche Trainings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Verpasst</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.missed}</div>
            <p className="text-xs text-gray-500 mt-1">nicht erschienen</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <CardHeader>
            <CardTitle>Kalenderübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                <div key={day} className="text-center font-semibold text-gray-700 text-xs py-2">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day) => {
                const attendance = getAttendanceForDay(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={`
                      min-h-[60px] p-1 rounded border transition-colors
                      ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 opacity-50'}
                      ${isToday ? 'border-brand-primary border-2' : 'border-gray-200'}
                      ${attendance ? 'cursor-pointer hover:bg-gray-50' : ''}
                    `}
                  >
                    <div className="text-xs font-medium text-gray-700 mb-1">{format(day, 'd')}</div>
                    {attendance && (
                      <div
                        className={`p-1 rounded text-[11px] flex items-center justify-center gap-1 ${getStatusColor(attendance.status)}`}
                      >
                        {getStatusIcon(attendance.status)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                <span>Teilgenommen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                <span>Nicht erschienen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                <span>Storniert</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                <span>Bevorstehend</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Detaillierte Anwesenheitsliste</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Keine Anwesenheitsdaten für diesen Monat
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.session.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${getStatusColor(record.status)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white/50 rounded-lg">
                        {getStatusIcon(record.status)}
                      </div>
                      <div>
                        <div className="font-semibold">
                          {format(record.date, 'EEEE, dd. MMMM yyyy', { locale: de })}
                        </div>
                        <div className="text-sm opacity-80">
                          {record.session.startTime} - {record.session.endTime} mit{' '}
                          {record.session.trainerName || 'Trainer'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{getStatusLabel(record.status)}</div>
                      {record.session.notes && (
                        <div className="text-xs opacity-80 mt-1">{record.session.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
