import { requireAuth } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import Link from 'next/link';
import {
  Calendar,
  BookOpen,
  CreditCard,
  Trophy,
  ArrowRight,
  ClipboardCheck,
  HardHat,
  MessageSquare,
  Users,
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
import { MyTeamsCard } from '@/components/league/my-teams-card';
import { TennisBallEmptyState } from '@/components/ui/empty-state';
import { OUTSTANDING_INVOICE_STATUSES } from '@/lib/billing/invoice-visibility';

export const dynamic = 'force-dynamic';

// Zeilenmasse wie in den übrigen Dashboards.
const HEAD_CELL = 'h-auto px-5 pb-2.5 pt-0 text-2xs uppercase tracking-[0.09em]';
const BODY_CELL = 'px-5 py-2.5';

export default async function MemberPage() {
  const { supabase, user } = await requireAuth();

  // Use .limit(1) instead of .maybeSingle() to gracefully handle users
  // with multiple club memberships (e.g. multi-tenant setups).  maybeSingle()
  // throws when >1 row is returned, which causes the onboarding form to show
  // even for active members.
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  const membership = memberships?.[0] ?? null;

  if (!membership) {
    return (
      <TennisBallEmptyState
        title="Keine aktive Mitgliedschaft"
        description="Du bist aktuell keinem Verein zugeordnet. Bitte wende dich an den Administrator deines Vereins."
        size="md"
      />
    );
  }

  const clubsData = membership.clubs;
  const club = Array.isArray(clubsData) ? clubsData[0] : clubsData;
  const clubId = membership.club_id;

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('features')
    .eq('id', clubId)
    .single();
  const features = (clubRow?.features as Record<string, boolean>) ?? {};

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  // Steht dieses Mitglied in einer Mannschaftsmeldung? Nur dann bekommt es den
  // Schnellzugriff auf "Mannschaften" — für alle anderen wäre das ein Link ins
  // Leere, und der Schnellzugriff ist die einzige Navigation, die Mitglieder
  // haben (sie sehen keine Sidebar).
  const { count: rosterCount } = await supabase
    .from('league_players')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('club_id', clubId);
  const isInSquad = (rosterCount ?? 0) > 0;

  const firstName =
    profile?.full_name?.split(' ')[0] ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'Mitglied';

  const nowIso = new Date().toISOString();

  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(
      'id, session_start_time, status, sessions(id, timeslot_start, timeslot_end, courts(name))'
    )
    .eq('member_id', user.id)
    .eq('status', 'confirmed')
    .gte('session_start_time', nowIso)
    .order('session_start_time', { ascending: true })
    .limit(4);

  // Die Kacheln zeigen Gesamtzahlen, die Listen darunter nur die nächsten
  // Einträge — deshalb eigene Zählabfragen. Vorher war die Kachel schlicht
  // `upcomingBookings.length` bei `.limit(3)`: ein Mitglied mit 20 Terminen
  // las dort dauerhaft "3 bevorstehend".
  const { count: upcomingBookingCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('status', 'confirmed')
    .gte('session_start_time', nowIso);

  const { count: upcomingTrainingCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('status', 'confirmed')
    .not('session_id', 'is', null)
    .gte('session_start_time', nowIso);

  // Die Trainingseinheiten stammen aus den eigenen Buchungen. Bis hierher fragte
  // die Seite vereinsweit `sessions` ab — auf dem Mitglieder-Dashboard stand
  // damit unter "Nächste Session" das nächste Training des VEREINS, oft das
  // einer fremden Gruppe.
  const nextSessions = (upcomingBookings ?? [])
    .map((b: { sessions?: unknown }) => b.sessions)
    .filter(Boolean) as {
    id: string;
    timeslot_start: string;
    timeslot_end: string;
    courts?: unknown;
  }[];

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  // Nicht nur `status = 'open'`: Eine verschickte, überfällige oder angemahnte
  // Rechnung ist genauso offen. Vorher zeigte die Kachel einem Mitglied mit
  // überfälliger Rechnung „0 offen".
  const { count: openInvCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .in('status', OUTSTANDING_INVOICE_STATUSES);

  const bookingCount = upcomingBookingCount ?? 0;
  const notifCount = unreadCount ?? 0;
  const invoiceCount = openInvCount ?? 0;

  const nextSession = nextSessions.length > 0 ? nextSessions[0] : null;
  const nextCourt = nextSession
    ? (() => {
        const c = nextSession.courts;
        return c ? (Array.isArray(c) ? c[0] : c) : null;
      })()
    : null;

  // formatDate/formatTime kommen aus @/lib/format und legen Europe/Berlin fest.
  // Die vorherigen lokalen Helfer nutzten toLocale*String ohne timeZone und
  // rendern damit in der Zeitzone der Laufzeit — auf Vercel (UTC) erschien ein
  // 18:00-Training als 16:00.

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      {/* Ohne Avatar-Initiale: das Nutzerbild steht bereits im Header rechts.
          Ohne Hero-Pills: dieselben Ziele stehen direkt darunter als Kacheln. */}
      <div>
        <h1 className="font-display text-[28px] sm:text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground dark:text-white">
          Hallo, {firstName}
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          {club?.name ?? 'Mein Verein'} · Mitglied
        </p>
      </div>

      {/* ── Stat Cards ── */}
      {/* Stehen vor dem Schnellzugriff: erst der Status („was liegt an?"),
          dann die Aktionen. */}
      <KpiBand
        items={[
          { label: 'Buchungen', value: bookingCount, sub: 'bevorstehend', href: '/bookings' },
          {
            label: 'Rechnungen',
            value: invoiceCount,
            sub: invoiceCount > 0 ? 'zu bezahlen' : 'nichts offen',
            // Nur offene Rechnungen sind ein Signal; 0 ist der Normalfall.
            tone: invoiceCount > 0 ? 'down' : 'flat',
            href: '/billing',
          },
          {
            label: 'Benachrichtigungen',
            value: notifCount,
            sub: notifCount > 0 ? 'ungelesen' : 'keine neuen',
            href: '/notifications',
          },
          {
            label: 'Training',
            value: upcomingTrainingCount ?? 0,
            sub: 'kommende Sessions',
            href: '/bookings',
          },
        ]}
      />

      {/* ── Quick Actions ── */}
      <QuickActions
        label="Schnellzugriff"
        actions={[
          { label: 'Buchen', href: '/scheduler', icon: Calendar },
          { label: 'Training', href: '/bookings', icon: BookOpen },
          ...(features.tournaments === true
            ? [
                {
                  label: 'Turniere',
                  href: '/member/tournaments',
                  icon: Trophy,
                },
              ]
            : []),
          ...(isInSquad
            ? [
                {
                  label: 'Mannschaften',
                  href: '/member/leagues',
                  icon: Trophy,
                },
              ]
            : []),
          { label: 'Rechnungen', href: '/billing', icon: CreditCard },
          ...(features.family_accounts === true
            ? [
                {
                  label: 'Familienkonto',
                  href: '/member/family',
                  icon: Users,
                },
              ]
            : []),
          // Member sehen keine Sidebar (siehe protected-client-layout.tsx) —
          // was hier fehlt, ist für sie faktisch nicht erreichbar. Nachrichten
          // hingen vorher nur an den entfernten Hero-Pills, die eigene
          // Anwesenheit war überhaupt nirgends verlinkt.
          { label: 'Nachrichten', href: '/messages', icon: MessageSquare },
          {
            label: 'Anwesenheit',
            href: '/attendance-history',
            icon: ClipboardCheck,
          },
          ...(features.work_duty === true
            ? [
                {
                  label: 'Dienste',
                  href: '/member/work-duties',
                  icon: HardHat,
                },
              ]
            : []),
          {
            label: 'Präferenzen',
            href: '/member/preferences',
            icon: ClipboardCheck,
          },
        ]}
      />

      {/* ── Meine Mannschaften (nur für Spieler in einer Meldeliste) ── */}
      <MyTeamsCard />

      {/* ── Nächster Termin ──
          Der eine Punkt, wegen dem ein Mitglied diese Seite überhaupt öffnet.
          Vorher war er eine Karte wie jede andere: gleicher Rahmen, gleiche
          Schriftgrösse, dazu eine Eyebrow-Zeile mit Blitz-Symbol und eine
          „HEUTE"-Pille — vier Elemente, die um dieselbe Aufmerksamkeit rangen.
          Jetzt trägt die Uhrzeit die Information, alles andere ordnet sich
          unter. Der Tag steht als Wort daneben, nicht als Signalpille. */}
      {nextSession ? (
        <Link href="/bookings" className="group block">
          <Card variant="interactive" padding="none">
            <div className="flex items-stretch">
              <div className="w-1 shrink-0 rounded-l-xl bg-primary" aria-hidden="true" />
              <div className="flex flex-1 items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {isToday(nextSession.timeslot_start)
                      ? 'Heute'
                      : formatDate(nextSession.timeslot_start)}
                  </p>
                  <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.03em] text-foreground dark:text-white tabular-nums">
                    {formatTime(nextSession.timeslot_start)}
                    <span className="text-muted-foreground">
                      –{formatTime(nextSession.timeslot_end)}
                    </span>
                  </p>
                  <p className="mt-2 truncate text-sm text-muted-foreground">
                    {nextCourt?.name ?? 'Training'}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Card>
        </Link>
      ) : (
        <Card padding="none">
          <div className="p-5">
            <p className="font-semibold text-foreground">Noch kein Termin gebucht</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Freie Plätze und Trainingszeiten stehen in der Platzbuchung.
            </p>
            <Link
              href="/bookings"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Zur Platzbuchung <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {/* ── Kommende Termine ──
          Bis 18.08.2026 standen hier zwei Karten: „Nächste Buchungen" und
          „Trainingseinheiten". Die zweite war eine Teilmenge der ersten —
          `nextSessions` entsteht aus genau denselben `upcomingBookings` —, also
          dieselben Termine ein zweites Mal, nur ohne den ersten. Eine Liste.

          Auch weg: das „Bestätigt"-Badge an jeder Zeile. Die Abfrage filtert auf
          `status = 'confirmed'`; ein Merkmal, das ausnahmslos alle Zeilen tragen,
          unterscheidet nichts und ist damit reine Fläche.

          Und keine Kartenhülle mehr um die Liste: eine Überschrift und
          Trennlinien reichen. Vier gerahmte Blöcke untereinander waren der
          Hauptgrund, warum die Seite wie ein Baukasten aussah. */}
      {(upcomingBookings ?? []).length > 0 && (
        <Card className="p-0">
          <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
            <CardTitle className="text-sm font-semibold">Kommende Termine</CardTitle>
            <Link
              href="/bookings"
              className="shrink-0 text-[12.5px] font-medium text-primary hover:underline"
            >
              Alle →
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* Datum und Uhrzeit als eigene Spalten: dadurch stehen die Termine
                untereinander auf einer Kante und lassen sich vergleichen,
                statt jeweils hinter einem Symbol neu anzusetzen. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(HEAD_CELL, 'w-[30%]')}>Datum</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[16%]')}>Zeit</TableHead>
                  <TableHead className={HEAD_CELL}>Platz</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[16%] text-right')}>Art</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingBookings!.map((b: any) => {
                  const court = Array.isArray(b.sessions?.courts)
                    ? b.sessions.courts[0]
                    : b.sessions?.courts;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className={cn(BODY_CELL, 'text-muted-foreground tabular-nums')}>
                        {formatDate(b.session_start_time)}
                      </TableCell>
                      <TableCell className={cn(BODY_CELL, 'font-medium tabular-nums')}>
                        {formatTime(b.session_start_time)}
                      </TableCell>
                      <TableCell className={BODY_CELL}>{court?.name ?? 'Platz'}</TableCell>
                      <TableCell className={cn(BODY_CELL, 'text-right text-muted-foreground')}>
                        {b.sessions ? 'Training' : 'Platzbuchung'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
