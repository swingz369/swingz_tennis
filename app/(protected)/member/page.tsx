import { requireAuth } from '@/lib/auth';
import { formatCurrency, formatTime, formatWeekdayDate } from '@/lib/format';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListState } from '@/components/ui/list-state';
import { NextUpHero } from '@/components/ui/next-up-hero';
import { PageHeader } from '@/components/ui/page-header';
import { SessionRow } from '@/components/ui/session-row';
import { KpiBand } from '@/components/ui/kpi-band';
import { QuickActions } from '@/components/ui/quick-actions';
import { MyTeamsCard } from '@/components/league/my-teams-card';
import { TennisBallEmptyState } from '@/components/ui/empty-state';
import { OUTSTANDING_INVOICE_STATUSES } from '@/lib/billing/invoice-visibility';

export const dynamic = 'force-dynamic';

export default async function MemberPage() {
  const { supabase, user } = await requireAuth();

  // Use .limit(1) instead of .maybeSingle() to gracefully handle users
  // with multiple club memberships (e.g. multi-tenant setups).  maybeSingle()
  // throws when >1 row is returned, which causes the onboarding form to show
  // even for active members.
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name, features)')
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

  const features = (club?.features as Record<string, boolean>) ?? {};
  const nowIso = new Date().toISOString();

  // Alle Abfragen sind voneinander unabhängig — parallel statt neun Roundtrips nacheinander.
  const [
    { data: profile },
    // Steht dieses Mitglied in einer Mannschaftsmeldung? Nur dann bekommt es den
    // Schnellzugriff auf "Mannschaften" — für alle anderen wäre das ein Link ins
    // Leere, und der Schnellzugriff ist die einzige Navigation, die Mitglieder
    // haben (sie sehen keine Sidebar).
    { count: rosterCount },
    { data: upcomingBookings },
    // Die Kacheln zeigen Gesamtzahlen, die Listen darunter nur die nächsten
    // Einträge — deshalb eigene Zählabfragen. Vorher war die Kachel schlicht
    // `upcomingBookings.length` bei `.limit(3)`: ein Mitglied mit 20 Terminen
    // las dort dauerhaft "3 bevorstehend".
    { count: upcomingBookingCount },
    { count: upcomingTrainingCount },
    { count: unreadCount },
    // Nicht nur `status = 'open'`: Eine verschickte, überfällige oder angemahnte
    // Rechnung ist genauso offen. Vorher zeigte die Kachel einem Mitglied mit
    // überfälliger Rechnung „0 offen".
    { data: openInvoices },
  ] = await Promise.all([
    supabase.from('users').select('full_name, email').eq('id', user.id).maybeSingle(),
    supabase
      .from('league_players')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', user.id)
      .eq('club_id', clubId),
    supabase
      .from('bookings')
      .select(
        'id, session_start_time, status, sessions(id, timeslot_start, timeslot_end, courts(name))'
      )
      .eq('member_id', user.id)
      .eq('status', 'confirmed')
      .gte('session_start_time', nowIso)
      .order('session_start_time', { ascending: true })
      .limit(4),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', user.id)
      .eq('status', 'confirmed')
      .gte('session_start_time', nowIso),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', user.id)
      .eq('status', 'confirmed')
      .not('session_id', 'is', null)
      .gte('session_start_time', nowIso),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
    supabase
      .from('invoices')
      .select('amount, paid_amount')
      .eq('member_id', user.id)
      .in('status', OUTSTANDING_INVOICE_STATUSES),
  ]);

  const isInSquad = (rosterCount ?? 0) > 0;

  const firstName =
    profile?.full_name?.split(' ')[0] ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'Mitglied';

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

  const openInvCount = openInvoices?.length ?? 0;
  const openAmount = (openInvoices ?? []).reduce(
    (sum, inv) => sum + (inv.amount ?? 0) - (inv.paid_amount ?? 0),
    0
  );

  const bookingCount = upcomingBookingCount ?? 0;
  const notifCount = unreadCount ?? 0;
  const invoiceCount = openInvCount;

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

  // PostgREST liefert Einbettungen je nach Beziehung als Objekt oder Liste.
  const one = <T,>(x: T | T[] | null | undefined): T | undefined =>
    Array.isArray(x) ? x[0] : (x ?? undefined);

  return (
    <div className="space-y-6">
      {/* ── Matchday-Startseite (ADR-007) ──
          Aufbau der Vorlage: dunkle „Als Nächstes"-Karte mit der einen
          Hauptaktion, daneben der Weg zur Platzbuchung; darunter Kennzahlen,
          die Terminliste als Zeilen und der Stand der Rechnungen. */}
      <PageHeader
        eyebrow={`${formatWeekdayDate(new Date())} · Hallo ${firstName}`}
        title={nextSession ? 'Dein nächster Aufschlag.' : 'Zeit für ein Match.'}
        description={`${club?.name ?? 'Mein Verein'} · Dein Training, deine Plätze, dein Verein.`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        {nextSession ? (
          <NextUpHero
            eyebrow={`${isToday(nextSession.timeslot_start) ? 'Heute' : formatWeekdayDate(nextSession.timeslot_start)} · ${formatTime(nextSession.timeslot_start)}–${formatTime(nextSession.timeslot_end)}`}
            title="Training"
            meta={nextCourt?.name ?? undefined}
            action={{ label: 'Termin ansehen', href: '/bookings' }}
          />
        ) : (
          <NextUpHero
            eyebrow="Als Nächstes"
            title="Noch kein Termin gebucht."
            meta="Freie Plätze und Trainingszeiten findest du in der Platzbuchung."
            action={{ label: 'Platz buchen', href: '/scheduler' }}
          />
        )}

        <Card className="flex flex-col justify-between p-6">
          <div>
            <Badge variant="default" className="uppercase tracking-[0.08em]">
              Zeit für dein Spiel
            </Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">
              Lust auf eine Extra-Runde?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Freie Zeiten auf allen Plätzen siehst du im Platzkalender.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6 self-start">
            <Link href="/scheduler">
              Platz buchen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Deine Termine</h2>
            <Link href="/bookings" className="text-sm font-semibold text-primary hover:underline">
              Alle →
            </Link>
          </div>
          {(upcomingBookings ?? []).length > 0 ? (
            upcomingBookings!.map((b) => {
              const session = one(b.sessions);
              return (
                <SessionRow
                  key={b.id}
                  href="/bookings"
                  start={formatTime(b.session_start_time)}
                  end={session?.timeslot_end ? formatTime(session.timeslot_end) : undefined}
                  title={session ? 'Training' : 'Platzbuchung'}
                  meta={`${formatWeekdayDate(b.session_start_time)} · ${one(session?.courts)?.name ?? 'Platz'}`}
                />
              );
            })
          ) : (
            <ListState
              empty
              emptyTitle="Keine kommenden Termine"
              emptyHint="Buche einen Platz oder melde dich zu einem Training an."
            />
          )}
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Deine Rechnungen
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] tabular-nums">
              {invoiceCount > 0 ? `${formatCurrency(openAmount)} offen.` : 'Alles bezahlt.'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {invoiceCount > 0
                ? `${invoiceCount} ${invoiceCount === 1 ? 'Rechnung ist' : 'Rechnungen sind'} noch offen. Alle Angaben findest du in der Rechnung.`
                : 'Du hast keine offenen Rechnungen.'}
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6 self-start">
            <Link href="/billing">
              Rechnungen ansehen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </div>

      {/* ── Meine Mannschaften (nur für Spieler in einer Meldeliste) ── */}
      <MyTeamsCard />

      {/* ── Schnellzugriff ── */}
      <QuickActions
        label="Schnellzugriff"
        actions={[
          { label: 'Buchen', href: '/scheduler', icon: Calendar },
          { label: 'Training', href: '/bookings', icon: BookOpen },
          ...(features.tournaments === true
            ? [{ label: 'Turniere', href: '/member/tournaments', icon: Trophy }]
            : []),
          ...(isInSquad ? [{ label: 'Mannschaften', href: '/member/leagues', icon: Trophy }] : []),
          { label: 'Rechnungen', href: '/billing', icon: CreditCard },
          ...(features.family_accounts === true
            ? [{ label: 'Familienkonto', href: '/member/family', icon: Users }]
            : []),
          { label: 'Nachrichten', href: '/messages', icon: MessageSquare },
          { label: 'Anwesenheit', href: '/attendance-history', icon: ClipboardCheck },
          ...(features.work_duty === true
            ? [{ label: 'Dienste', href: '/member/work-duties', icon: HardHat }]
            : []),
          { label: 'Präferenzen', href: '/member/preferences', icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}
