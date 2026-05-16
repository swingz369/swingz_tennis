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
  ClipboardCheck,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  timeslot_start?: string;
  timeslot_end?: string;
  status?: string;
  maxParticipants?: number;
  attendees?: Array<{ bookingId: string; memberName: string; status: string }>;
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
      const statsData = data.stats ?? data;
      setStats({
        totalSessions: statsData.totalSessions ?? data.sessions?.length ?? 0,
        upcomingSessions: statsData.upcomingSessions ?? 0,
        thisWeekSessions: statsData.sessionsThisWeek ?? statsData.thisWeekSessions ?? 0,
        attendanceRate: statsData.attendanceRate ?? 0,
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
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        {/* 2x2 stats grid skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-2 bg-white dark:bg-surface-dark">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
        {/* Sessions list skeleton */}
        <div className="rounded-2xl border bg-white dark:bg-surface-dark">
          <div className="px-5 pt-5 pb-3">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="px-5 pb-5 space-y-0 divide-y divide-gray-100 dark:divide-white/10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={fetchData} className="text-sm text-brand-light hover:underline">
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

      {/* Stats — 2x2 grid, bigger numbers */}
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
            color: 'text-brand-light',
            bg: 'bg-brand-light/10',
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
          <Card key={stat.label} className="border-0 shadow-sm p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming sessions — bigger touch targets (min 60px) */}
      <Card className="p-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Kommende Einheiten
            <Link
              href="/scheduler"
              className="text-xs text-brand-light hover:underline font-normal flex items-center gap-1"
            >
              Alle <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <IconBox icon={Calendar} size="lg" variant="gray" className="mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Keine bevorstehenden Sessions
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {sessions.slice(0, 5).map((session) => {
                const court = Array.isArray(session.courts) ? session.courts[0] : session.courts;
                const group = Array.isArray(session.groups) ? session.groups[0] : session.groups;
                const startIso = session.startTime || session.timeslot_start || '';
                const endIso = session.endTime || session.timeslot_end || '';
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 py-3.5"
                    style={{ minHeight: 60 }}
                  >
                    <IconBox icon={Calendar} size="md" variant="light" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {group?.name || court?.name || 'Training'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(startIso)} · {formatTime(startIso)}–{formatTime(endIso)}
                      </p>
                    </div>
                    {/* Quick attendance button */}
                    <Link
                      href={`/attendance-history?session=${session.id}`}
                      className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg bg-brand-light/10 hover:bg-brand-light/20 transition-colors text-brand-light text-xs font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Anwesenheit
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
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
            { label: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock },
            { label: 'Nachrichten', href: '/notifications', icon: Users },
          ].map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-brand-light/40 hover:shadow-sm transition-all active:scale-95"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light/10">
                <action.icon className="h-5 w-5 text-brand-light" />
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
