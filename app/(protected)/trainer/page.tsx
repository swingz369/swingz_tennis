'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Session {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  status?: string;
  courts?: { name: string } | { name: string }[];
  groups?: { name: string } | { name: string }[];
}

interface TrainerStats {
  totalSessions: number;
  upcomingSessions: number;
  thisWeekSessions: number;
  attendanceRate: number;
}

export default function TrainerPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<TrainerStats>({
    totalSessions: 0,
    upcomingSessions: 0,
    thisWeekSessions: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trainer/me', {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Trainer-Daten');
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setStats({
        totalSessions: data.totalSessions ?? data.sessions?.length ?? 0,
        upcomingSessions: data.upcomingSessions ?? 0,
        thisWeekSessions: data.thisWeekSessions ?? 0,
        attendanceRate: data.attendanceRate ?? 0,
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message ?? 'Unbekannter Fehler');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#40916C]" />
        <p className="text-sm text-muted-foreground">Lade Trainer-Daten…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={fetchData} className="text-sm text-[#40916C] hover:underline">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trainer Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Deine Übersicht</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Gesamt Sessions',
            value: stats.totalSessions,
            icon: Calendar,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Kommende',
            value: stats.upcomingSessions,
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: 'Diese Woche',
            value: stats.thisWeekSessions,
            icon: Clock,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
          },
          {
            label: 'Anwesenheitsrate',
            value: `${stats.attendanceRate}%`,
            icon: CheckCircle,
            color: 'text-amber-600',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Kommende Einheiten
            <Link
              href="/scheduler"
              className="text-xs text-[#40916C] hover:underline font-normal flex items-center gap-1"
            >
              Alle <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Keine bevorstehenden Sessions.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {sessions.slice(0, 5).map((session) => {
                const court = Array.isArray(session.courts) ? session.courts[0] : session.courts;
                const group = Array.isArray(session.groups) ? session.groups[0] : session.groups;
                return (
                  <div key={session.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#40916C]/10 shrink-0">
                      <Calendar className="h-4 w-4 text-[#40916C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {group?.name || court?.name || 'Training'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.timeslot_start)} · {formatTime(session.timeslot_start)}–
                        {formatTime(session.timeslot_end)}
                      </p>
                    </div>
                    {session.status && (
                      <Badge
                        variant={session.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {session.status === 'active' ? 'Aktiv' : session.status}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links — matches TSOW trainer tab layout */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Einheiten', href: '/scheduler', icon: Calendar },
            { label: 'Anwesenheit', href: '/attendance-history', icon: CheckCircle },
            { label: 'Mein Profil', href: '/profile', icon: Users },
            { label: 'Abrechnung', href: '/billing', icon: TrendingUp },
            { label: 'Verfügbarkeit', href: '/scheduler', icon: Clock },
            { label: 'Nachrichten', href: '/notifications', icon: Users },
          ].map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-[#40916C]/40 hover:shadow-sm transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#40916C]/10">
                <action.icon className="h-5 w-5 text-[#40916C]" />
              </div>
              <span className="text-xs font-medium text-center leading-tight text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
