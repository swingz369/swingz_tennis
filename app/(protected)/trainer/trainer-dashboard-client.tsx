'use client';

import Link from 'next/link';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  ClipboardCheck,
  BarChart3,
  Bell,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickActions } from '@/components/ui/quick-actions';
import { TrainerRsvpList } from '@/components/trainer-rsvp-list';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Button } from '@/components/ui/button';

export interface TrainerSession {
  id: string;
  startTime: string;
  endTime: string;
  maxParticipants?: number;
  attendees?: Array<{ bookingId: string; memberName: string; status: string }>;
  courtName?: string;
  groupName?: string;
}

export interface TrainerStats {
  totalSessions: number;
  upcomingSessions: number;
  thisWeekSessions: number;
  attendanceRate: number;
}

interface TrainerDashboardClientProps {
  sessions: TrainerSession[];
  stats: TrainerStats;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TrainerDashboardClient({ sessions, stats }: TrainerDashboardClientProps) {
  // Calculate today's sessions
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todaySessions = sessions.filter((s) => {
    const iso = s.startTime || '';
    return iso.substring(0, 10) === todayStr;
  });

  // Adapt sessions for TrainerRsvpList (needs startTime/endTime/timeslot_start/timeslot_end)
  const rsvpSessions = sessions.map((s) => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    timeslot_start: s.startTime,
    timeslot_end: s.endTime,
  }));

  return (
    <div className="space-y-6">
      {/* ── Hero Header ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-noise opacity-5" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/70 mb-1">Trainer-Bereich</p>
                <h1 className="text-2xl md:text-3xl font-bold">Willkommen zurück</h1>
                <p className="text-white/70 mt-2">
                  Deine Übersicht über Sessions, Anwesenheit und mehr
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  className="bg-background/15 backdrop-blur-sm border-white/20 text-white hover:bg-background/25"
                >
                  <Link href="/scheduler">Alle Einheiten</Link>
                </Button>
                <div className="hidden sm:flex items-center gap-2 rounded-xl bg-background/10 backdrop-blur-sm px-4 py-2.5">
                  <Clock className="h-5 w-5 text-brand-accent" />
                  <span className="text-sm font-medium">
                    {todaySessions.length > 0 ? (
                      <>{todaySessions.length} Sessions heute</>
                    ) : (
                      <>
                        <AnimatedCounter value={stats.upcomingSessions} /> kommende
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScrollReveal delay={0}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Gesamt Sessions</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats.totalSessions} />
                  </p>
                  <p className="text-xs text-muted-foreground">alle Zeiten</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Kommende</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats.upcomingSessions} />
                  </p>
                  <p className="text-xs text-muted-foreground">anstehende Einheiten</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Diese Woche</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats.thisWeekSessions} />
                  </p>
                  <p className="text-xs text-muted-foreground">Einheiten geplant</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Timer className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Anwesenheit</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats.attendanceRate} suffix="%" />
                  </p>
                  <p className="text-xs text-muted-foreground">Quote</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* ── Upcoming sessions ── */}
      <ScrollReveal delay={300}>
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
                {sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 py-3.5 hover:bg-muted/50 transition-colors rounded-lg -mx-2 px-2 group/item"
                  >
                    <div className="h-10 w-10 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground dark:text-white truncate">
                        {session.groupName || session.courtName || 'Training'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(session.startTime)} · {formatTime(session.startTime)}–
                        {formatTime(session.endTime)}
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* ── Session RSVPs & Check-in ── */}
      <ScrollReveal delay={350}>
        <TrainerRsvpList sessions={rsvpSessions} />
      </ScrollReveal>

      {/* ── Quick Actions ── */}
      <ScrollReveal delay={400}>
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
            {
              label: 'Verfügbarkeit',
              href: '/trainer/availability',
              icon: Clock,
              variant: 'purple',
            },
            { label: 'Profil', href: '/trainer/profile', icon: Users, variant: 'green' },
            { label: 'Abrechnung', href: '/billing', icon: BarChart3, variant: 'amber' },
            { label: 'Nachrichten', href: '/notifications', icon: Bell, variant: 'blue' },
          ]}
        />
      </ScrollReveal>
    </div>
  );
}
