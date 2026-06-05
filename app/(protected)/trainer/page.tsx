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
  Award,
  BarChart3,
  Bell,
} from 'lucide-react';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrainerRsvpList } from '@/components/trainer-rsvp-list';
import { apiFetch } from '@/lib/api-fetch';

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
      const res = await apiFetch('/api/trainer/me', {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // Gracefully handle missing trainer profile (admin accessing trainer page)
        if (res.status === 403 || res.status === 404) {
          setError(
            errData.error ?? 'Kein Trainer-Profil gefunden. Bitte wende dich an den Administrator.'
          );
          return;
        }
        throw new Error(errData.error ?? 'Fehler beim Laden der Trainer-Daten');
      }
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
    new Date(iso).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary/10 to-brand-dark/5 p-6">
          <Skeleton className="h-7 w-48 bg-white/30" />
          <Skeleton className="h-4 w-28 mt-2 bg-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-2 bg-white dark:bg-white/5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-white dark:bg-white/5">
          <div className="px-5 pt-5 pb-3">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="px-5 pb-5 space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-4 border-t border-gray-100 dark:border-white/10"
              >
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
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={fetchData}
          className="text-sm font-medium text-brand-light hover:text-brand-primary dark:hover:text-brand-light/80 transition-colors underline underline-offset-4"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-8 text-white">
          <div className="absolute inset-0 bg-noise opacity-5" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/70 mb-1">Trainer Dashboard</p>
                <h1 className="text-3xl font-bold">Willkommen zurück</h1>
                <p className="text-white/70 mt-2">
                  Deine Übersicht über Sessions, Anwesenheit und mehr
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2.5">
                <Award className="h-5 w-5 text-brand-accent" />
                <span className="text-sm font-medium">{stats.attendanceRate}% Anwesenheit</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Stats — 2x2 grid with animated counters */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Gesamt Sessions',
              value: stats.totalSessions,
              icon: Calendar,
              gradient: 'from-blue-500 to-indigo-600',
              bg: 'bg-blue-50 dark:bg-blue-900/20',
            },
            {
              label: 'Kommende',
              value: stats.upcomingSessions,
              icon: TrendingUp,
              gradient: 'from-brand-light to-brand-primary',
              bg: 'bg-brand-light/10',
            },
            {
              label: 'Diese Woche',
              value: stats.thisWeekSessions,
              icon: Clock,
              gradient: 'from-purple-500 to-purple-700',
              bg: 'bg-purple-50 dark:bg-purple-900/20',
            },
            {
              label: 'Anwesenheitsrate',
              value: stats.attendanceRate,
              suffix: '%',
              icon: CheckCircle,
              gradient: 'from-amber-500 to-orange-600',
              bg: 'bg-amber-50 dark:bg-amber-900/20',
            },
          ].map((stat, i) => (
            <Card
              key={stat.label}
              className="border-0 shadow-sm p-0 hover-lift transition-all duration-300 group"
              variant="elevated"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}
                  >
                    <stat.icon className="h-5 w-5 text-brand-primary dark:text-brand-light" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix || ''}
                    duration={1200 + i * 200}
                  />
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollReveal>

      {/* Upcoming sessions */}
      <ScrollReveal delay={200}>
        <Card className="p-0 border-0 shadow-sm bg-white dark:bg-white/5 backdrop-blur-sm overflow-hidden">
          <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-white/10">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-light/10 text-brand-light">
                  <Calendar className="h-4 w-4" />
                </div>
                <span>Kommende Einheiten</span>
              </div>
              <Link
                href="/scheduler"
                className="text-xs text-brand-light hover:text-brand-primary dark:hover:text-brand-light/80 transition-colors font-normal flex items-center gap-1 group"
              >
                Alle anzeigen
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                  <Calendar className="h-7 w-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Keine bevorstehenden Sessions
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Sobald dir Einheiten zugewiesen werden, erscheinen sie hier
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
                      className="flex items-center gap-3 py-3.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors rounded-lg -mx-2 px-2 group/item"
                    >
                      <div className="h-10 w-10 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center shrink-0 group-hover/item:scale-110 transition-transform">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {group?.name || court?.name || 'Training'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDate(startIso)} · {formatTime(startIso)}–{formatTime(endIso)}
                        </p>
                      </div>
                      <Link
                        href={`/attendance-history?session=${session.id}`}
                        className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-brand-light/10 hover:bg-brand-light/20 dark:bg-white/5 dark:hover:bg-white/10 transition-all text-brand-light text-xs font-medium group/link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5 transition-transform group-hover/link:scale-110" />
                        <span className="hidden sm:inline">Anwesenheit</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Session RSVPs & Check-in */}
      <ScrollReveal delay={250}>
        <TrainerRsvpList sessions={sessions} />
      </ScrollReveal>

      {/* Quick links */}
      <ScrollReveal delay={300}>
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-5 w-1 rounded-full bg-brand-light" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Schnellzugriff
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Einheiten', href: '/scheduler', icon: Calendar },
              { label: 'Anwesenheit', href: '/attendance-history', icon: ClipboardCheck },
              { label: 'Mein Profil', href: '/profile', icon: Users },
              { label: 'Abrechnung', href: '/billing', icon: BarChart3 },
              { label: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock },
              { label: 'Nachrichten', href: '/notifications', icon: Bell },
            ].map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-brand-light/30 hover:shadow-lg hover:shadow-brand-light/5 transition-all duration-300 active:scale-95"
              >
                <div className="h-11 w-11 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center group-hover:bg-brand-light group-hover:text-white transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-center leading-tight text-gray-600 dark:text-gray-300 group-hover:text-brand-primary dark:group-hover:text-brand-light transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
