/**
 * Öffentliche Sales-Demo — kein Login nötig.
 *
 * ponytail: statische Beispieldaten statt echter DB-Anbindung. Zeigt die
 * 4 Kernmodule (Mitglieder, Trainer, Saison, Finanzen) anhand eines
 * fiktiven "TC Musterstadt". Kein Schreibzugriff, keine echten Kundendaten.
 * Upgrade-Pfad falls gewünscht: echten "TC Demo"-Verein (siehe
 * /api/clubs/seed-demo) read-only über Service-Client ausliefern.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Users,
  GraduationCap,
  CalendarRange,
  Wallet,
  Trophy,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Live-Demo — SWINGZ',
  description:
    'Sieh dir SWINGZ live an, ganz ohne Registrierung: Mitgliederverwaltung, Trainerplanung, Saisonplanung und Abrechnung am Beispiel eines Tennisvereins.',
  alternates: { canonical: '/demo' },
};

const UPCOMING_SESSIONS = [
  { time: 'Heute, 16:00', group: 'Anfänger Gruppe 1', trainer: 'M. Weber', court: 'Platz 2' },
  { time: 'Heute, 17:30', group: 'Fortgeschrittene 1', trainer: 'S. Klein', court: 'Halle 1' },
  { time: 'Heute, 18:00', group: 'Kids Anfänger', trainer: 'J. Fischer', court: 'Platz 1' },
  { time: 'Morgen, 09:00', group: 'Turnierspieler', trainer: 'M. Weber', court: 'Halle 2' },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══════════ NAV ═══════════ */}
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <IconBox icon={Trophy} size="sm" variant="gradient-primary" />
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                SWINGZ
              </span>
            </Link>
            <Button size="sm" asChild>
              <Link href="/register">
                Kostenlos starten
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ═══════════ DEMO BANNER ═══════════ */}
      <div className="border-b border-border bg-muted/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="accent">Demo-Modus</Badge>
            <span className="text-muted-foreground">
              Beispieldaten von &ldquo;TC Musterstadt&rdquo; — nichts wird gespeichert
            </span>
          </div>
          <Link href="/register" className="text-sm font-medium text-brand-primary hover:underline">
            Eigenen Verein einrichten →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 lg:px-8 py-10 space-y-10">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Admin-Dashboard · TC Musterstadt
          </h1>
          <p className="mt-1 text-muted-foreground">
            So sieht der Alltag eines Vereins mit 187 Mitgliedern in SWINGZ aus.
          </p>
        </div>

        {/* ═══════════ MITGLIEDER ═══════════ */}
        <section aria-labelledby="members-heading" className="space-y-4">
          <h2 id="members-heading" className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-info-600" aria-hidden="true" />
            Mitgliederverwaltung
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Aktive Mitglieder" value={187} color="blue" />
            <StatCard icon={Users} label="Neu diesen Monat" value={12} color="green" />
            <StatCard icon={Users} label="Bindungsrate" value="94%" color="purple" />
          </div>
        </section>

        {/* ═══════════ TRAINER ═══════════ */}
        <section aria-labelledby="trainers-heading" className="space-y-4">
          <h2 id="trainers-heading" className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-brand-accent-600" aria-hidden="true" />
            Trainerplanung
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard icon={GraduationCap} label="Trainer" value={8} color="orange" />
            <StatCard icon={Clock} label="Einheiten diese Woche" value={42} color="blue" />
            <StatCard icon={Wallet} label="Übungsleiterpauschale" value="genutzt" color="green" />
          </div>
          <Card padding="none">
            <CardHeader>
              <CardTitle>Nächste Einheiten</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeit</TableHead>
                    <TableHead>Gruppe</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Platz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {UPCOMING_SESSIONS.map((s) => (
                    <TableRow key={`${s.time}-${s.group}`}>
                      <TableCell className="whitespace-nowrap">{s.time}</TableCell>
                      <TableCell>{s.group}</TableCell>
                      <TableCell>{s.trainer}</TableCell>
                      <TableCell>{s.court}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* ═══════════ SAISONPLANUNG ═══════════ */}
        <section aria-labelledby="season-heading" className="space-y-4">
          <h2 id="season-heading" className="text-lg font-semibold flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-success-600" aria-hidden="true" />
            Saisonplanung
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={CalendarRange}
              label="Aktive Saison"
              value="Sommer 2026"
              color="green"
            />
            <StatCard icon={Users} label="Trainingsgruppen" value={14} color="blue" />
            <StatCard icon={Clock} label="Planung" value="veröffentlicht" color="purple" />
          </div>
        </section>

        {/* ═══════════ FINANZEN ═══════════ */}
        <section aria-labelledby="finance-heading" className="space-y-4">
          <h2 id="finance-heading" className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-primary" aria-hidden="true" />
            Abrechnung
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Wallet} label="Umsatz diesen Monat" value="8.450 €" color="green" />
            <StatCard icon={Wallet} label="Pünktliche Zahlungen" value="96%" color="blue" />
            <StatCard icon={Wallet} label="Offene Mahnungen" value={3} color="orange" />
          </div>
        </section>

        {/* ═══════════ CTA ═══════════ */}
        <section className="pt-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary text-white px-6 py-12 sm:px-16 sm:py-16 text-center shadow-strong">
            <div className="absolute inset-0 noise opacity-[0.04]" aria-hidden="true" />
            <div className="relative">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Bereit für euren eigenen Verein?
              </h2>
              <p className="mt-3 max-w-xl mx-auto text-white/75">
                14 Tage kostenlos. Keine Kreditkarte. Wir richten euch persönlich ein.
              </p>
              <Button
                size="lg"
                className="mt-6 bg-white text-brand-primary hover:bg-white/90 hover:brightness-100"
                asChild
              >
                <Link href="/register">
                  Kostenlos registrieren
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
