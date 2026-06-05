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
  BarChart3,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { QuickActions } from '@/components/ui/quick-actions';
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
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28 mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border">
          <div className="px-5 pt-5 pb-3">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="px-5 pb-5 space-y-0">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-4 border-t border-border dark:border-white/10"
              >
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
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
        <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchData}
          className="text-sm font-medium text-brand-light hover:underline underline-offset-4"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Willkommen zurück</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deine Übersicht über Sessions, Anwesenheit und mehr
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Calendar}
          label="Gesamt Sessions"
          value={stats.totalSessions}
          color="blue"
          animate
        />
        <StatCard
          icon={TrendingUp}
          label="Kommende"
          value={stats.upcomingSessions}
          color="brand"
          animate
        />
        <StatCard
          icon={Clock}
          label="Diese Woche"
          value={stats.thisWeekSessions}
          color="purple"
          animate
        />
        <StatCard
          icon={CheckCircle}
          label="Anwesenheit"
          value={stats.attendanceRate}
          color="green"
          animate
          suffix="%"
        />
      </div>

      {/* ── Upcoming sessions ── */}
      <Card className="p-0 border border-border dark:border-white/10 overflow-hidden">
        <CardHeader className="px-5 pt-5 pb-3 border-b border-border dark:border-white/10">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-light/10 text-brand-light">
                <Calendar className="h-4 w-4" />
              </div>
              <span>Kommende Einheiten</span>
            </div>
            <Link
              href="/scheduler"
              className="text-xs text-brand-light hover:underline font-normal flex items-center gap-1 group"
            >
              Alle anzeigen
              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Calendar className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Keine bevorstehenden Sessions
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sobald dir Einheiten zugewiesen werden, erscheinen sie hier
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border dark:divide-white/5">
              {sessions.slice(0, 5).map((session) => {
                const court = Array.isArray(session.courts) ? session.courts[0] : session.courts;
                const group = Array.isArray(session.groups) ? session.groups[0] : session.groups;
                const startIso = session.startTime || session.timeslot_start || '';
                const endIso = session.endTime || session.timeslot_end || '';
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 py-3.5 hover:bg-muted/50 transition-colors rounded-lg -mx-2 px-2 group/item"
                  >
                    <div className="h-10 w-10 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground dark:text-white truncate">
                        {group?.name || court?.name || 'Training'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(startIso)} · {formatTime(startIso)}–{formatTime(endIso)}
                      </p>
                    </div>
                    <Link
                      href={`/attendance-history?session=${session.id}`}
                      className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-brand-light/10 hover:bg-brand-light/20 transition-all text-brand-light text-xs font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Anwesenheit</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Session RSVPs & Check-in ── */}
      <TrainerRsvpList sessions={sessions} />

      {/* ── Quick Actions ── */}
      <QuickActions
        label="Schnellzugriff"
        actions={[
          { label: 'Einheiten', href: '/scheduler', icon: Calendar, variant: 'light' },
          {
            label: 'Anwesenheit',
            href: '/attendance-history',
            icon: ClipboardCheck,
            variant: 'blue',
          },
          { label: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock, variant: 'purple' },
          { label: 'Profil', href: '/profile', icon: Users, variant: 'green' },
          { label: 'Abrechnung', href: '/billing', icon: BarChart3, variant: 'amber' },
          { label: 'Nachrichten', href: '/notifications', icon: Bell, variant: 'blue' },
        ]}
      />
    </div>
  );
}
