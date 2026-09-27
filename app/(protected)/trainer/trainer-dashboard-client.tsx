'use client';

import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';
import { useState } from 'react';
import {
  asUtcIso,
  formatDate as formatDateBerlin,
  formatTime as formatTimeBerlin,
  formatWeekdayDate,
} from '@/lib/format';
import {
  ArrowRight,
  Calendar,
  Users,
  Clock,
  ClipboardCheck,
  BarChart3,
  Bell,
  CreditCard,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListState } from '@/components/ui/list-state';
import { NextUpHero } from '@/components/ui/next-up-hero';
import { SessionRow } from '@/components/ui/session-row';
import { KpiBand } from '@/components/ui/kpi-band';
import { QuickActions } from '@/components/ui/quick-actions';
import { TrainerRsvpList } from '@/components/trainer-rsvp-list';
import { ScrollReveal } from '@/components/animations';

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

  // Nur Kommendes: vorher standen hier die ersten fünf Einheiten überhaupt —
  // am 27.09. also Termine vom 07.09.
  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(asUtcIso(s.startTime) as string) >= now);
  const next = upcoming[0];
  const isToday = (iso: string) => iso.substring(0, 10) === todayStr;
  const openAttendance = (id: string) => {
    setSelectedSessionId(id);
    document
      .getElementById('session-teilnehmer')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const participants = (s: TrainerSession) =>
    `${s.attendees?.length ?? 0} ${s.attendees?.length === 1 ? 'Teilnehmer' : 'Teilnehmende'}`;

  return (
    <div className="space-y-6">
      {/* ── Matchday-Startseite (ADR-007): nächste Einheit mit der einen
          Hauptaktion „Anwesenheit erfassen", daneben die Woche. ── */}
      <PageHeader
        eyebrow={`${formatWeekdayDate(today)}${trainerName ? ` · Hallo ${trainerName.split(' ')[0]}` : ''}`}
        title="Bereit fürs Training."
        description={
          todaySessions.length > 0
            ? `${todaySessions.length} ${todaySessions.length === 1 ? 'Einheit' : 'Einheiten'} heute. Deine Gruppen, deine Termine.`
            : upcoming.length > 0
              ? `Heute nichts — ${upcoming.length} kommende ${upcoming.length === 1 ? 'Einheit' : 'Einheiten'}.`
              : 'Keine Einheiten geplant.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        {next ? (
          <NextUpHero
            eyebrow={`${isToday(next.startTime) ? 'Heute' : formatWeekdayDate(asUtcIso(next.startTime))} · ${formatTime(next.startTime)}–${formatTime(next.endTime)}`}
            title={next.groupName || 'Training'}
            meta={[next.courtName, participants(next)].filter(Boolean).join(' · ')}
            action={{ label: 'Anwesenheit erfassen', onClick: () => openAttendance(next.id) }}
          />
        ) : (
          <NextUpHero
            eyebrow="Als Nächstes"
            title="Keine Einheit geplant."
            meta="Sobald dir Einheiten zugewiesen werden, stehen sie hier."
            action={{ label: 'Verfügbarkeit pflegen', href: '/trainer/availability' }}
          />
        )}

        <Card className="flex flex-col justify-between p-6">
          <div>
            <Badge variant="default" className="uppercase tracking-[0.08em]">
              Deine Trainingswoche
            </Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">
              {stats.thisWeekSessions === 1
                ? 'Eine Einheit diese Woche.'
                : `${stats.thisWeekSessions} Einheiten diese Woche.`}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Anwesenheit führst du für jede Einheit einzeln — gespeicherte Angaben kannst du
              jederzeit bearbeiten.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6 self-start">
            <Link href="/scheduler">
              Platzkalender <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </div>

      <KpiBand
        items={[
          { label: 'Diese Woche', value: stats.thisWeekSessions, sub: 'Einheiten geplant' },
          { label: 'Kommende', value: stats.upcomingSessions, sub: 'anstehend' },
          {
            label: 'Anwesenheit',
            value: `${stats.attendanceRate}`,
            suffix: '%',
            sub: 'Quote',
            tone: stats.attendanceRate >= 80 ? 'up' : 'flat',
          },
          { label: 'Gesamt', value: stats.totalSessions, sub: 'alle Zeiten' },
        ]}
      />

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Deine Trainings</h2>
            <p className="text-sm text-muted-foreground">
              {upcoming.length === 1
                ? '1 kommende Einheit'
                : `${upcoming.length} kommende Einheiten`}
              {upcoming.length > 5 && ' · die nächsten 5'}
            </p>
          </div>
          <Link href="/scheduler" className="text-sm font-semibold text-primary hover:underline">
            Kalender →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <ListState
            empty
            emptyTitle="Keine bevorstehenden Einheiten"
            emptyHint="Sobald dir welche zugewiesen werden, stehen sie hier."
          />
        ) : (
          upcoming.slice(0, 5).map((session) => (
            <SessionRow
              key={session.id}
              start={formatTime(session.startTime)}
              end={formatTime(session.endTime)}
              title={session.groupName || 'Training'}
              meta={[formatDate(session.startTime), session.courtName, participants(session)]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <Button variant="outline" size="sm" onClick={() => openAttendance(session.id)}>
                  Anwesenheit
                </Button>
              }
            />
          ))
        )}
      </Card>

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
            { label: 'Platzkalender', href: '/scheduler', icon: Calendar },
            // „Anwesenheit" → /attendance-history entfernt: derselbe Fehlgriff,
            // den der Kommentar oben für den Session-Knopf beschreibt. Die Seite
            // zeigt die Anwesenheit eines MITGLIEDS und lieferte dem Trainer
            // „Keine Einträge gefunden". Die Teilnehmerliste öffnet der Trainer
            // direkt an der Einheit in der Liste darüber.
            {
              label: 'Abwesenheiten',
              href: '/trainer/absences',
              icon: ClipboardCheck,
            },
            {
              label: 'Verfügbarkeit',
              href: '/trainer/availability',
              icon: Clock,
            },
            {
              label: 'Meine Planungswünsche',
              href: '/trainer/planning-preferences',
              icon: Target,
            },
            { label: 'Profil', href: '/trainer/profile', icon: Users },
            // Hieß „Abrechnung" und zeigte auf /billing — das sind die eigenen
            // Mitgliedsrechnungen, nicht das Trainerhonorar. Die Stundennachweise
            // sind die Grundlage der Honorarabrechnung; eine Trainer-Ansicht der
            // fertigen Abrechnung existiert bisher nicht (nur admin-seitig).
            {
              label: 'Meine Stunden',
              href: '/trainer/hours-logs',
              icon: BarChart3,
            },
            {
              label: 'Meine Abrechnung',
              href: '/trainer/billing',
              icon: CreditCard,
            },
            // Zeigte auf /notifications — das sind die Benachrichtigungs-
            // Einstellungen, nicht die Nachrichten.
            { label: 'Nachrichten', href: '/messages', icon: Bell },
          ]}
        />
      </ScrollReveal>
    </div>
  );
}
