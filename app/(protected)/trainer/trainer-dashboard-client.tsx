'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  asUtcIso,
  formatDate as formatDateBerlin,
  formatTime as formatTimeBerlin,
} from '@/lib/format';
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
  CreditCard,
  Timer,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickActions } from '@/components/ui/quick-actions';
import { IconBox } from '@/components/ui/icon-box';
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
  trainerId?: string;
  trainerName?: string;
}

// `sessions.timeslot_start/-end` tragen keine Zeitzone (siehe asUtcIso). Ohne
// die Korrektur las der Browser sie als deutsche Ortszeit und zeigte ein
// 18:00-Training als 16:00 an.
function formatDate(iso: string) {
  return formatDateBerlin(asUtcIso(iso));
}

function formatTime(iso: string) {
  return formatTimeBerlin(asUtcIso(iso));
}

export default function TrainerDashboardClient({
  sessions,
  stats,
  trainerId,
  trainerName,
}: TrainerDashboardClientProps) {
  // Die Auswahl liegt hier statt in TrainerRsvpList, damit der
  // "Anwesenheit"-Knopf einer Einheit direkt die passende Teilnehmerliste
  // öffnen kann. Vorher verwies er auf /attendance-history — die Ansicht, in
  // der ein MITGLIED seine eigene Anwesenheit sieht; sie ignoriert den
  // session-Parameter und zeigte dem Trainer "Keine Einträge gefunden".
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
            Trainer-Bereich
          </p>
          <h1 className="text-2xl font-bold font-display text-foreground dark:text-white tracking-tight">
            Willkommen zurück
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deine Übersicht über Sessions, Anwesenheit und mehr
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button asChild variant="outline">
            <Link href="/scheduler">Alle Einheiten</Link>
          </Button>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border dark:border-white/10 px-4 py-2.5">
            <Clock className="h-4 w-4 text-brand-light" />
            <span className="text-sm font-medium text-foreground dark:text-white">
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
                <IconBox
                  icon={Calendar}
                  size="md"
                  variant="blue"
                  className="transition-transform duration-300 group-hover:scale-110"
                />
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
                <IconBox
                  icon={TrendingUp}
                  size="md"
                  variant="primary"
                  className="transition-transform duration-300 group-hover:scale-110"
                />
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
                <IconBox
                  icon={Timer}
                  size="md"
                  variant="purple"
                  className="transition-transform duration-300 group-hover:scale-110"
                />
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
                <IconBox
                  icon={CheckCircle}
                  size="md"
                  variant="green"
                  className="transition-transform duration-300 group-hover:scale-110"
                />
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
                <div className="p-1.5 rounded-xl bg-brand-light/10 text-brand-light">
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
                <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-3">
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
                    className="flex items-center gap-3 py-3.5 hover:bg-muted/50 transition-colors rounded-xl -mx-2 px-2 group/item"
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
                    <button
                      type="button"
                      className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-brand-light/10 hover:bg-brand-light/20 transition-all text-brand-light text-xs font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSessionId(session.id);
                        document
                          .getElementById('session-teilnehmer')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Anwesenheit</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* ── Session RSVPs & Check-in ── */}
      <ScrollReveal delay={350}>
        <div id="session-teilnehmer">
          <TrainerRsvpList
            sessions={rsvpSessions}
            trainerId={trainerId}
            trainerName={trainerName}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
        </div>
      </ScrollReveal>

      {/* ── Quick Actions ── */}
      <ScrollReveal delay={400}>
        <QuickActions
          label="Schnellzugriff"
          actions={[
            { label: 'Platzkalender', href: '/scheduler', icon: Calendar, variant: 'light' },
            // „Anwesenheit" → /attendance-history entfernt: derselbe Fehlgriff,
            // den der Kommentar oben für den Session-Knopf beschreibt. Die Seite
            // zeigt die Anwesenheit eines MITGLIEDS und lieferte dem Trainer
            // „Keine Einträge gefunden". Die Teilnehmerliste öffnet der Trainer
            // direkt an der Einheit in der Liste darüber.
            {
              label: 'Abwesenheiten',
              href: '/trainer/absences',
              icon: ClipboardCheck,
              variant: 'blue',
            },
            {
              label: 'Verfügbarkeit',
              href: '/trainer/availability',
              icon: Clock,
              variant: 'purple',
            },
            {
              label: 'Meine Planungswünsche',
              href: '/trainer/planning-preferences',
              icon: Target,
              variant: 'indigo',
            },
            { label: 'Profil', href: '/trainer/profile', icon: Users, variant: 'green' },
            // Hieß „Abrechnung" und zeigte auf /billing — das sind die eigenen
            // Mitgliedsrechnungen, nicht das Trainerhonorar. Die Stundennachweise
            // sind die Grundlage der Honorarabrechnung; eine Trainer-Ansicht der
            // fertigen Abrechnung existiert bisher nicht (nur admin-seitig).
            {
              label: 'Meine Stunden',
              href: '/trainer/hours-logs',
              icon: BarChart3,
              variant: 'amber',
            },
            {
              label: 'Meine Abrechnung',
              href: '/trainer/billing',
              icon: CreditCard,
              variant: 'green',
            },
            // Zeigte auf /notifications — das sind die Benachrichtigungs-
            // Einstellungen, nicht die Nachrichten.
            { label: 'Nachrichten', href: '/messages', icon: Bell, variant: 'blue' },
          ]}
        />
      </ScrollReveal>
    </div>
  );
}
