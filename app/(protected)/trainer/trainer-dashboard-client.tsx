'use client';

import { PageHeader } from '@/components/ui/page-header';
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
  ClipboardCheck,
  BarChart3,
  Bell,
  CreditCard,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { KpiBand } from '@/components/ui/kpi-band';
import { QuickActions } from '@/components/ui/quick-actions';
import { TrainerRsvpList } from '@/components/trainer-rsvp-list';
import { ScrollReveal } from '@/components/animations';

// Zeilenmasse wie im Admin-, Owner- und Superadmin-Dashboard.
const HEAD_CELL = 'h-auto px-5 pb-2.5 pt-0 text-2xs uppercase tracking-[0.09em]';
const BODY_CELL = 'px-5 py-2.5';

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
      {/* ── Kopf ──
          Vorher stand hier eine dreizeilige Anrede („Trainer-Bereich" /
          „Willkommen zurück" / „Deine Übersicht über Sessions, Anwesenheit und
          mehr") plus rechts eine Pille mit derselben Zahl, die zwei Zeilen
          tiefer noch einmal als Kachel kam. Jetzt: wer, und was heute ansteht. */}
      <PageHeader
        title={trainerName ? `Hallo, ${trainerName.split(' ')[0]}` : 'Trainer-Übersicht'}
        description={
          todaySessions.length > 0
            ? `${todaySessions.length} ${todaySessions.length === 1 ? 'Einheit' : 'Einheiten'} heute`
            : stats.upcomingSessions > 0
              ? `Heute nichts — ${stats.upcomingSessions} kommende ${stats.upcomingSessions === 1 ? 'Einheit' : 'Einheiten'}`
              : 'Keine Einheiten geplant'
        }
        actions={[{ label: 'Alle Einheiten', href: '/scheduler', variant: 'outline' }]}
      />

      {/* Kennzahlen als Band statt als vier gerahmte Kacheln — gleiche
          Begründung wie in components/ui/kpi-band.tsx. */}
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

      {/* ── Kommende Einheiten ──
          Tabelle in einer Karte, Datum und Uhrzeit als eigene Spalten: so
          stehen die Termine auf einer gemeinsamen Kante und lassen sich
          vergleichen. Die Symbol-Kachel je Zeile ist weg — sie war an jeder
          Zeile dieselbe und unterschied damit nichts. */}
      <Card className="p-0">
        <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
          <div>
            <CardTitle className="text-sm font-semibold">Kommende Einheiten</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {sessions.length === 1 ? '1 Einheit' : `${sessions.length} Einheiten`}
              {sessions.length > 5 && ' · die nächsten 5'}
            </p>
          </div>
          <Link
            href="/scheduler"
            className="shrink-0 text-[12.5px] font-medium text-primary hover:underline"
          >
            Alle anzeigen →
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {sessions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              Keine bevorstehenden Einheiten. Sobald dir welche zugewiesen werden, stehen sie hier.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(HEAD_CELL, 'w-[22%]')}>Datum</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[18%]')}>Zeit</TableHead>
                  <TableHead className={HEAD_CELL}>Gruppe / Platz</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[14%] text-right')}>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.slice(0, 5).map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className={cn(BODY_CELL, 'text-muted-foreground tabular-nums')}>
                      {formatDate(session.startTime)}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'font-medium tabular-nums')}>
                      {formatTime(session.startTime)}–{formatTime(session.endTime)}
                    </TableCell>
                    <TableCell className={BODY_CELL}>
                      {session.groupName || session.courtName || 'Training'}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-right')}>
                      <button
                        type="button"
                        className="text-[12.5px] font-medium text-primary hover:underline"
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          document
                            .getElementById('session-teilnehmer')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                      >
                        Anwesenheit
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
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
