import { requireAdminClub } from '@/lib/admin-context';
import Link from 'next/link';
import {
  UserPlus,
  Receipt,
  LockKeyhole,
  Calendar,
  Sparkles,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumAdminHero } from '@/components/admin/premium-admin-hero';
import { KpiBand, type KpiBandItem } from '@/components/ui/kpi-band';
import { CourtOccupancyHeatmap } from '@/components/admin/court-occupancy-heatmap';
import { SeasonProgressCard, type SeasonProgress } from '@/components/admin/season-progress-card';
import {
  buildOccupancyGrid,
  currentWeekRange,
  OCCUPANCY_FIRST_HOUR,
  OCCUPANCY_LAST_HOUR,
} from '@/lib/court-occupancy';
import {
  ActivityFeedCompact,
  type TimelineActivityItem,
} from '@/components/admin/activity-feed-compact';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollReveal } from '@/components/animations';
import { formatDateTime } from '@/lib/format';
import { buildSetupChecklist, getSetupCounts } from '@/lib/setup-checklist';

export const dynamic = 'force-dynamic';

// Zeilenmasse der Buchungstabelle. Die geteilten Table-Bausteine bringen `p-4`
// und `h-10` mit — hier auf das Mass der Referenz (docs/SwingZ — Farbvarianten.html:
// td 11px, th 9px, bündig zum Kartenrand).
const HEAD_CELL = 'h-auto px-5 pb-2.5 pt-0';
const BODY_CELL = 'px-5 py-2.5';

// ─── Types ─────────────────────────────────────────────────────────────

// Explicit shape for the awaited `clubs` row. Used as the generic
// argument on `.maybeSingle<T>()` so the page no longer has to cast
// `club` (or its sub-fields) to `any` to satisfy TS strict mode
// (P0-B). Mirrors the columns the page actually reads.
type ClubRow = {
  id: string;
  name: string;
  status: string | null;
  dashboard_bg_url: string | null;
};

type SmartAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof UserPlus;
  /** Rechts stehende Kennzahl („3 offen", „4 fällig"). Trägt die Zahl, damit
   *  das Label die Handlung benennen kann statt sie mit ihr zu vermischen —
   *  „Rechnungen erstellen · 4 fällig" liest sich als eine Aktion mit einem
   *  Grund, „4 Rechnungen erstellen" als eine Aktion mit einer Menge. */
  badge?: string;
};

/**
 * Type-safe Supabase wrapper that preserves the upstream response shape.
 *
 * Why a generic wrapper? Returning a fixed `SafeResult = { data: unknown }`
 * would strip PostgREST's row inference off the destructured `data`
 * field. By parameterising on `T extends { data: unknown; ... }`, the
 * original row shape (e.g. `{ amount?: number }[]` or the embedded
 * booking join shape) flows through, and only the catch branch falls
 * back to a null payload.
 *
 * We DO NOT use `as any` anywhere — the upstream generic carries the
 * real types.
 */
async function safe<T extends { count: number | null; data: unknown; error: unknown }>(
  q: PromiseLike<T>
): Promise<T | { count: null; data: null; error: null }> {
  try {
    return await q;
  } catch {
    return { count: null, data: null, error: null };
  }
}

// ─── Component ─────────────────────────────────────────────────────────

export default async function AdminPage() {
  const { supabase, user, clubId, role } = await requireAdminClub();

  // Club info — explizites Generic statt `any`-Cast downstream.
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status, dashboard_bg_url')
    .eq('id', clubId)
    .maybeSingle<ClubRow>();

  if (!club) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Verein nicht gefunden.</p>
      </div>
    );
  }

  // Profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Admin';

  // Date ranges
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  // Prior-month range — feeds the honest "+X% zum Vormonat" growth
  // signal the KPI subs now show (P0-A). Previously hardcoded as
  // "+4%"/"+12%" with a fabricated trend-sparkline ramp.
  const priorMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const priorMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0, 23, 59, 59);

  // Parallel fetches split across TWO `Promise.all` blocks.
  //
  // Why nested? TypeScript's built-in `Promise.all` provides tuple
  // overloads only up to **10** elements. Passing 11+ collapses the
  // signature to the generic `Promise.all<T>(Iterable<T>)` form,
  // which mixes every response shape into one heterogeneous union
  // and forces PostgREST's inferred row type down to `{}` — so
  // `.map` / `.reduce` on `data` no longer typecheck. Splitting 11
  // into 6 + 5 keeps each block under the tuple limit while
  // preserving the exact response shape for every destructured
  // position. Both blocks run in parallel because `Promise.all([a,
  // b])` itself awaits them concurrently.
  const [
    setupCounts,
    { count: pendingApprovals },
    { count: activeSessions },
    { data: recentMembers },
    { data: recentBookings },
  ] = await Promise.all([
    // Einrichtungs-Checkliste: Plätze, Trainer, Mitglieder, Beitragskategorien,
    // Saisons. `members` zählt nur `role = 'member'` — die eigene
    // Admin-Mitgliedschaft ist kein eingeladenes Mitglied.
    getSetupCounts(supabase, clubId),
    safe(
      supabase
        .from('registration_requests')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('status', 'pending')
    ),
    safe(
      supabase
        .from('sessions')
        .select('id, schedules!inner(club_id)', { count: 'exact', head: true })
        .eq('schedules.club_id', clubId)
        .gte('timeslot_start', todayStart.toISOString())
        .lte('timeslot_start', todayEnd.toISOString())
    ),
    safe(
      supabase
        .from('user_club_memberships')
        .select('id, created_at, user_id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .eq('role', 'member')
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safe(
      supabase
        .from('bookings')
        .select(
          'id, booked_at, session_start_time, status, users!bookings_member_id_fkey(full_name), courts(name)'
        )
        .eq('club_id', clubId)
        .order('booked_at', { ascending: false })
        .limit(5)
    ),
  ]);

  // Second batch — counts + amount arrays for the KPI strip and the
  // honest prior-month growth comparison (P0-A).
  const [
    { data: paidInvoices },
    { count: totalInvoiceCount },
    { data: priorPaidInvoices },
    { count: priorMemberCount },
    { data: outstandingInvoices },
  ] = await Promise.all([
    safe(
      supabase
        .from('invoices')
        .select('amount')
        .eq('club_id', clubId)
        .eq('status', 'paid')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
    ),
    safe(
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('club_id', clubId)
    ),
    // NEW for P0-A: prior month paid invoices for honest revenue growth.
    safe(
      supabase
        .from('invoices')
        .select('amount')
        .eq('club_id', clubId)
        .eq('status', 'paid')
        .gte('created_at', priorMonthStart.toISOString())
        .lte('created_at', priorMonthEnd.toISOString())
    ),
    // NEW for P0-A: prior month active-member snapshot for honest
    // membership growth.
    safe(
      supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true)
        .eq('role', 'member')
        .lte('created_at', priorMonthEnd.toISOString())
    ),
    // Offene Forderungen: gestellte, aber unbezahlte Rechnungen. `draft` zählt
    // nicht mit (noch nicht verschickt), `cancelled` und `paid` erst recht nicht.
    safe(
      supabase
        .from('invoices')
        // `due_date` für die Begrüssungszeile: „4 Rechnungen fällig zum 01.09."
        // — die nächste Frist ist das, was den Satz handlungsrelevant macht.
        .select('amount, status, due_date')
        .eq('club_id', clubId)
        .in('status', ['open', 'overdue'])
    ),
  ]);

  // Dritter Block: Platzbelegung der laufenden Woche. Eigener Block, weil
  // die beiden oberen bereits an der 10er-Tuple-Grenze von `Promise.all`
  // kleben (Begründung im Kommentar darüber).
  //
  // Zwei Quellen, weil der Verein zwei Wege kennt, einen Platz zu belegen:
  // geplante `sessions` aus der Saisonplanung und `bookings` einzelner
  // Mitglieder. Nur eine davon zu zeigen würde die Karte systematisch
  // untertreiben. Doppelzählung schliesst `buildOccupancyGrid` aus.
  const week = currentWeekRange();
  const [{ data: weekSessions }, { data: weekBookings }] = await Promise.all([
    safe(
      supabase
        .from('sessions')
        .select('timeslot_start, court_id, schedules!inner(club_id)')
        .eq('schedules.club_id', clubId)
        .is('cancelled_at', null)
        .gte('timeslot_start', week.from)
        .lt('timeslot_start', week.to)
    ),
    safe(
      supabase
        .from('bookings')
        .select('session_start_time, court_id')
        .eq('club_id', clubId)
        .eq('status', 'confirmed')
        .gte('session_start_time', week.from)
        .lt('session_start_time', week.to)
    ),
  ]);

  const occupancyGrid = buildOccupancyGrid(
    [
      ...(weekSessions ?? []).map((s: Record<string, unknown>) => ({
        start: s.timeslot_start as string,
        courtId: (s.court_id as string | null) ?? null,
      })),
      ...(weekBookings ?? []).map((b: Record<string, unknown>) => ({
        start: b.session_start_time as string,
        courtId: (b.court_id as string | null) ?? null,
      })),
    ],
    setupCounts.courts ?? 0
  );

  // ── Saison-Fortschritt ──────────────────────────────────────────────
  // Die aktuellste Saison des Vereins plus die Zahl der bereits abgegebenen
  // Präferenzen. `head: true` mit `count` statt die Zeilen zu laden — gezählt
  // wird, nicht gelesen.
  const { data: currentSeason } = await safe(
    supabase
      .from('seasons')
      .select('id, name, planning_status, preferences_deadline, start_date, end_date')
      .eq('club_id', clubId)
      .order('start_date', { ascending: false })
      .limit(10)
  );

  type SeasonRow = {
    id: string;
    name: string;
    planning_status: string;
    preferences_deadline: string | null;
    start_date: string | null;
    end_date: string | null;
  };

  // Die Karte zeigte bisher die Saison mit dem spätesten Startdatum — im
  // August also bereits die Wintersaison, die erst im Oktober beginnt, samt
  // Fortschritt "KW 1 läuft". Maßgeblich ist die Saison, die heute läuft;
  // erst wenn keine läuft, ist die nächste anstehende die richtige Antwort.
  const seasonRows = (currentSeason ?? []) as SeasonRow[];
  const heute = new Date().toISOString().slice(0, 10);
  const season =
    seasonRows.find(
      (s) => s.start_date && s.end_date && s.start_date <= heute && heute <= s.end_date
    ) ??
    // aufsteigend: die nächste, die beginnt — nicht die fernste
    [...seasonRows]
      .filter((s) => s.start_date && s.start_date > heute)
      .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0] ??
    seasonRows[0];

  const { count: preferenceCount } = season
    ? await safe(
        supabase
          .from('user_training_preferences')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', season.id)
          .eq('user_role', 'member')
      )
    : { count: null };

  const memberCount = setupCounts.members;

  // Monthly revenue (current + prior for honest growth comparison).
  const monthlyRevenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: { amount?: number | null }) => sum + (inv.amount ?? 0),
    0
  );

  // Offene Forderungen — der Betrag, bei dem ein Vorstand tatsächlich handeln muss.
  const outstandingRows = (outstandingInvoices ?? []) as {
    amount?: number | null;
    status?: string | null;
    due_date?: string | null;
  }[];
  const outstandingAmount = outstandingRows.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
  const overdueCount = outstandingRows.filter((inv) => inv.status === 'overdue').length;
  // Nächste Frist über alle offenen Rechnungen — die Zahl in der Begrüssung
  // ohne Datum wäre eine Meldung, mit Datum eine Aufgabe.
  const nextInvoiceDue = outstandingRows
    .map((inv) => inv.due_date)
    .filter((d): d is string => typeof d === 'string' && !Number.isNaN(Date.parse(d)))
    .sort()[0];
  const priorMonthRevenue = (priorPaidInvoices ?? []).reduce(
    (sum: number, inv: { amount?: number | null }) => sum + (inv.amount ?? 0),
    0
  );

  // P0-A: honest growth percentages — null when no prior data exists.
  // Sparkline `buildTrend` consumes the same number so the card's
  // visual rhythm matches the speech bubble.
  const revenueGrowthPct =
    priorMonthRevenue > 0
      ? Math.round(((monthlyRevenue - priorMonthRevenue) / priorMonthRevenue) * 100)
      : null;
  const memberGrowthPct =
    priorMemberCount != null && priorMemberCount > 0
      ? Math.round((((memberCount ?? 0) - priorMemberCount) / priorMemberCount) * 100)
      : null;

  // user_club_memberships has no direct FK relationship PostgREST can
  // embed (user_id isn't declared against public.users), so `users(...)`
  // silently resolves to null instead of erroring. Two-step lookup.
  const recentMemberUserIds = (recentMembers ?? [])
    .map((m: Record<string, unknown>) => m.user_id as string)
    .filter(Boolean);
  const { data: recentMemberUsers } = recentMemberUserIds.length
    ? await supabase.from('users').select('id, full_name, email').in('id', recentMemberUserIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const recentMemberUserMap = new Map((recentMemberUsers ?? []).map((u) => [u.id, u]));

  // Activity merge
  type ActivityItem = {
    id: string;
    type: 'join' | 'booking';
    name: string;
    created_at: string;
    sub?: string;
  };

  const recentActivity: ActivityItem[] = [
    ...(recentMembers ?? []).map((m: Record<string, unknown>) => {
      const u = recentMemberUserMap.get(m.user_id as string);
      return {
        id: `join-${m.id}`,
        type: 'join' as const,
        name: u?.full_name || u?.email || 'Unbekannt',
        created_at: m.created_at as string,
        sub: 'Neues Mitglied',
      };
    }),
    ...(recentBookings ?? []).map((b: Record<string, unknown>) => {
      const u = Array.isArray(b.users) ? b.users[0] : b.users;
      return {
        id: `booking-${b.id}`,
        type: 'booking' as const,
        name: (u as Record<string, string>)?.full_name || 'Mitglied',
        created_at: b.booked_at as string,
        sub: 'Buchung erstellt',
      };
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  // ─── Canonical booking-status vocabulary (Dashboard "Letzte Buchungen") ──
  // Single Source of Truth for the dashboard's German status labels.
  // When you add a new booking status (e.g. `completed`, `rescheduled`),
  // extend both maps AND `BookingStatus` in lib/types/index.ts.
  const bookingStatusLabel: Record<string, string> = {
    confirmed: 'Bestätigt',
    cancelled: 'Storniert',
    no_show: 'Nicht erschienen',
    pending: 'Warteliste',
    waitlist: 'Warteliste',
  };
  const bookingStatusTone: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
    confirmed: 'success',
    cancelled: 'error',
    no_show: 'warning',
    pending: 'warning',
    waitlist: 'warning',
  };
  type LatestBooking = {
    id: string;
    memberName: string;
    courtName: string;
    dateTime: string;
    statusLabel: string;
    statusTone: 'success' | 'error' | 'warning' | 'default';
  };
  const latestBookings: LatestBooking[] = (recentBookings ?? []).map(
    (b: Record<string, unknown>) => {
      const u = Array.isArray(b.users) ? b.users[0] : b.users;
      const court = Array.isArray(b.courts) ? b.courts[0] : b.courts;
      const status = (b.status as string) ?? 'pending';
      return {
        id: b.id as string,
        memberName: (u as Record<string, string>)?.full_name || 'Unbekannt',
        courtName: (court as Record<string, string>)?.name ?? '—',
        dateTime: formatDateTime(b.session_start_time as string),
        statusLabel: bookingStatusLabel[status] ?? status,
        statusTone: bookingStatusTone[status] ?? 'default',
      };
    }
  );

  // Einrichtungs-Checkliste — Status aus den Daten abgeleitet, nicht
  // gespeichert. Sie verschwindet, sobald alles steht, und kommt zurück,
  // wenn jemand die letzte Beitragskategorie löscht. Kein Zeitfenster mehr:
  // ein Verein, der nach 30 Tagen noch keine Saison hat, braucht den Hinweis
  // dringender als einer am ersten Tag.
  const setupChecklist = buildSetupChecklist(setupCounts);

  // Smart actions: determine which contextual actions to show
  const needsApprovals = (pendingApprovals ?? 0) > 0;
  const needsBilling = (totalInvoiceCount ?? 0) === 0;
  const hasSessions = (activeSessions ?? 0) > 0;

  const smartActions: SmartAction[] = [];

  if (needsApprovals) {
    smartActions.push({
      label: 'Anfragen genehmigen',
      description: 'Neue Mitgliedsanfragen warten auf dich',
      href: '/admin/members?tab=approvals',
      icon: UserPlus,
      badge: `${pendingApprovals} offen`,
    });
  }
  if (overdueCount > 0) {
    smartActions.push({
      label: 'Rechnungen mahnen',
      description: 'Überfällige Rechnungen anschreiben',
      href: '/admin/billing',
      icon: Receipt,
      badge: `${overdueCount} fällig`,
    });
  }
  if (needsBilling) {
    smartActions.push({
      label: 'Rechnungen erstellen',
      description: `Monatsabrechnung für ${memberCount ?? 0} Mitglieder`,
      href: '/admin/billing',
      icon: Receipt,
    });
  }
  if (hasSessions) {
    // P0-C fix: singularize when activeSessions === 1.
    smartActions.push({
      label: 'Sessions überprüfen',
      description: `${activeSessions === 1 ? '1 Session' : `${activeSessions} Sessions`} heute aktiv`,
      href: '/admin/seasons',
      icon: Calendar,
      badge: `${activeSessions} heute`,
    });
  }

  smartActions.push({
    label: 'Mitglied einladen',
    description: 'Neues Mitglied zum Verein hinzufügen',
    href: '/admin/members',
    icon: UserPlus,
  });
  smartActions.push({
    label: 'Platz verwalten',
    description: 'Plätze sperren oder Kalender einsehen',
    href: '/admin/courts',
    icon: LockKeyhole,
  });

  // ─── Derived data for new premium components ───

  const timelineActivity: TimelineActivityItem[] = recentActivity.map((item) => ({
    id: item.id,
    type: 'activity',
    title: item.name,
    subtitle: item.sub ?? '',
    startISO: item.created_at,
    href: item.type === 'join' ? '/admin/members' : '/admin/billing',
    variant: item.type,
  }));

  const activityFooterHref =
    timelineActivity.length === 0
      ? '/admin/seasons'
      : timelineActivity.some((i) => i.variant === 'booking')
        ? '/admin/billing'
        : '/admin/members';

  // Tage bis zum Präferenz-Stichtag. Auf Tagesgrenzen normalisiert, damit
  // „endet in 9 Tagen" nicht je nach Uhrzeit zwischen 8 und 9 springt.
  const seasonDaysLeft = (() => {
    if (!season?.preferences_deadline) return null;
    const deadline = new Date(season.preferences_deadline);
    deadline.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
  })();

  const seasonProgress: SeasonProgress | null = season
    ? {
        name: season.name,
        planningStatus: season.planning_status,
        submitted: preferenceCount ?? 0,
        total: memberCount ?? 0,
        daysLeft: seasonDaysLeft,
        startDate: season.start_date,
        endDate: season.end_date,
        href: `/admin/seasons/${season.id}/planning`,
      }
    : null;

  // KPI-Band statt vier Karten. Die Sparklines sind mit den Karten
  // weggefallen: sie ramp­ten aus *einer* Wachstumszahl fünf interpolierte
  // Punkte hoch — eine gezeichnete Kurve, für die es nie fünf Messwerte gab.
  // Die Wachstumszahl selbst steht weiterhin darunter, die war echt.
  const kpiItems: KpiBandItem[] = [
    {
      label: 'Mitglieder',
      value: memberCount ?? 0,
      sub:
        memberGrowthPct === null
          ? 'noch keine Vergleichsdaten'
          : `${memberGrowthPct >= 0 ? '+' : ''}${memberGrowthPct} % zum Vormonat`,
      tone: memberGrowthPct === null ? 'flat' : memberGrowthPct >= 0 ? 'up' : 'down',
      href: '/admin/members',
    },
    {
      label: 'Sessions heute',
      value: activeSessions ?? 0,
      sub: hasSessions ? 'live' : 'keine Sessions heute',
      tone: 'flat',
      href: '/admin/seasons',
    },
    {
      label: 'Umsatz ' + new Date().toLocaleDateString('de-DE', { month: 'short' }),
      value: monthlyRevenue > 0 ? `${monthlyRevenue.toLocaleString('de-DE')} €` : '0 €',
      sub:
        revenueGrowthPct === null
          ? monthlyRevenue > 0
            ? 'noch keine Vergleichsdaten'
            : 'noch keine Zahlung diesen Monat'
          : `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct} % zum Vormonat`,
      tone: revenueGrowthPct === null ? 'flat' : revenueGrowthPct >= 0 ? 'up' : 'down',
      href: '/admin/billing',
    },
    {
      // Ersetzt „Anfragen offen": das stand meistens auf 0, und eine 0 ist keine
      // Kennzahl, sondern eine Benachrichtigung — offene Beitrittsanfragen melden
      // sich weiterhin über die Aktionskarten und den Tab-Badge unter Mitglieder.
      // Der ausstehende Betrag ist dagegen der Wert, bei dem ein Vorstand handelt.
      label: 'Offene Forderungen',
      value: outstandingAmount > 0 ? `${outstandingAmount.toLocaleString('de-DE')} €` : '0 €',
      sub:
        overdueCount > 0
          ? `${overdueCount} überfällig`
          : outstandingAmount > 0
            ? `${outstandingRows.length} offene Rechnung${outstandingRows.length !== 1 ? 'en' : ''}`
            : 'nichts ausstehend',
      tone: overdueCount > 0 ? 'down' : 'flat',
      href: '/admin/billing',
    },
  ];

  // Smart-action card markup — extracted as a closure so the Side-Column
  // layout (P0-D) can render the same cards inside the right Hero column
  // without duplicating the whole JSX block.
  // Schmale Listenzeile statt breiter Karte. Drei Karten quer über die Seite
  // beanspruchten die prominenteste Fläche des Dashboards für Navigation —
  // dort stehen jetzt die Kennzahlen. Als Liste in der Nebenspalte bleiben die
  // Aktionen erreichbar, ohne den Blick zuerst auf sich zu ziehen.
  const renderSmartAction = (action: SmartAction) => (
    <Link
      key={action.href + action.label}
      href={action.href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-ring/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconBox icon={action.icon} size="xs" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{action.label}</span>
      {action.badge && (
        <span className="shrink-0 rounded px-1.5 tabular-nums text-2xs font-semibold text-destructive">
          {action.badge}
        </span>
      )}
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero + Schnellaktionen, one framed unit ──
          Both live inside a single card now instead of a bare text block
          next to boxed action cards — that mismatch used to read as
          leftover whitespace under the greeting. Urgent smart actions
          already carry the orange pulse treatment, so there is no
          separate "attention" banner repeating the same CTA below. */}
      <ScrollReveal>
        <div
          className={
            club.dashboard_bg_url
              ? 'grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4 items-stretch'
              : ''
          }
        >
          {/* Kein Kartenrahmen mehr um die Begrüssung: eine Karte verspricht
              „hier ist ein abgegrenzter Inhalt", die Begrüssung ist aber der
              Seitenkopf. Der Rahmen liess sie wie ein Widget aussehen und
              erzeugte zusammen mit dem KPI-Band darunter zwei konkurrierende
              Kanten direkt untereinander. */}
          <div className="space-y-5">
            <PremiumAdminHero
              firstName={firstName}
              role={role as 'owner' | 'superadmin' | 'admin'}
              todaySessionCount={activeSessions ?? 0}
              openInvoiceCount={outstandingRows.length}
              overdueInvoiceCount={overdueCount}
              nextInvoiceDue={nextInvoiceDue}
            />
          </div>

          {club.dashboard_bg_url && (
            // Small side thumbnail instead of a full-width banner — a
            // near-square crop (capped width, stretches to the hero
            // card's height on lg+) is forgiving for whatever aspect
            // ratio an admin's photo happens to have, unlike a wide,
            // short strip which crops almost any real photo badly.
            <div className="rounded-xl border border-border dark:border-white/10 overflow-hidden aspect-square lg:aspect-auto max-w-[220px] w-full mx-auto lg:mx-0 lg:max-w-none lg:w-full lg:h-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative club photo, dynamic external URL */}
              <img
                src={club.dashboard_bg_url}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* ── KPI-Band — trägt die Zahlen ohne Kartenrahmen ── */}
      <ScrollReveal delay={100}>
        <KpiBand items={kpiItems} />
      </ScrollReveal>

      {/* ── Einrichtung — bleibt sichtbar, bis der Verein einsatzbereit ist ── */}
      {!setupChecklist.allDone && (
        <ScrollReveal delay={200}>
          <div className="rounded-xl border border-brand-light/20 bg-brand-light/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-light" />
              <p className="text-sm font-semibold text-foreground">Einrichtung</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {setupChecklist.doneCount}/{setupChecklist.totalCount} erledigt
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {setupChecklist.steps.map((item) => {
                // Erledigt oder blockiert: kein Link. Ein blockierter Schritt
                // führt sonst auf eine Seite, die den Admin gleich wieder
                // wegschickt — die fehlende Voraussetzung steht hier.
                const clickable = !item.done && !item.blocked;
                const body = (
                  <div
                    className={`flex items-start gap-3 rounded-xl px-3 py-2.5 h-full transition-all ${
                      item.done
                        ? 'bg-success-50 cursor-default'
                        : item.blocked
                          ? 'bg-muted/40 border border-dashed border-border cursor-not-allowed'
                          : 'bg-background border border-border hover:border-brand-light/40 cursor-pointer'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                        item.done ? 'bg-success-100' : 'border-2 border-border'
                      }`}
                    >
                      {item.done ? (
                        <span className="text-success-600 text-xs font-bold">✓</span>
                      ) : item.blocked ? (
                        <LockKeyhole className="h-3 w-3 text-muted-foreground" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-sm ${
                          item.done
                            ? 'line-through text-muted-foreground'
                            : item.blocked
                              ? 'text-muted-foreground font-medium'
                              : 'text-foreground font-medium'
                        }`}
                      >
                        {item.label}
                      </span>
                      {!item.done && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.blocked
                            ? `Erst möglich nach: ${item.blockedBy.join(', ')}`
                            : item.hint}
                        </p>
                      )}
                    </div>
                    {clickable && <span className="text-muted-foreground text-xs mt-0.5">→</span>}
                  </div>
                );

                return clickable ? (
                  <Link key={item.key} href={item.href}>
                    {body}
                  </Link>
                ) : (
                  <div key={item.key} aria-disabled="true">
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* ── Bento: Buchungen + Aktivität, darunter Belegung ──
          12-Spalten-Raster statt zwei Reihen à eigenem Grid. Buchungen (8)
          und Aktivität (4) stehen oben, die Heatmap (8) mit der Aktivität
          daneben — so füllt die Wochenbelegung die Fläche, die vorher unter
          der kurzen Aktivitätsliste leer blieb. */}
      <ScrollReveal delay={300}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Beide Spalten stapeln ihre Karten selbst (`space-y`), statt
              Grid-Zeilen zu teilen. Mit geteilten Zeilen richtete sich die
              Zeilenhöhe an der höheren Spalte aus und riss unter der kurzen
              Buchungstabelle eine Lücke von mehreren hundert Pixeln auf. */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-border dark:border-white/10 shadow-sm p-0">
              {/* Kopfzeile trägt Titel, Umfang und Ausgang — der Link stand
                  vorher allein unter der Tabelle und war dort eine eigene
                  Zeile Leerraum für einen Klick, den kaum jemand macht. */}
              <CardHeader className="px-5 pt-5 pb-3 flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                    <IconBox icon={Calendar} size="xs" variant="light" />
                    Letzte Buchungen
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestBookings.length === 1
                      ? '1 Vorgang'
                      : `${latestBookings.length} Vorgänge`}
                  </p>
                </div>
                <Link
                  href="/scheduler"
                  className="shrink-0 text-[12.5px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Alle Buchungen →
                </Link>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {latestBookings.length > 0 ? (
                  // Kein `Badge` mehr für den Status: fünf gefüllte Pillen
                  // untereinander waren das Lauteste in der Tabelle, obwohl
                  // „Bestätigt" der Normalfall ist und niemanden interessiert.
                  // Ein Punkt plus Wort trägt dieselbe Information leiser — und
                  // lässt „Warteliste" tatsächlich herausstechen.
                  <Table>
                    <TableHeader>
                      {/* Zeilenhöhe: die geteilten Table-Bausteine bringen `p-4`
                          und `h-10` mit — bei fünf Vorgängen ergab das eine
                          Karte, die fast so hoch war wie die Heatmap darunter,
                          ohne mehr zu sagen. Hier auf das Mass der Referenz
                          (docs/SwingZ — Farbvarianten.html: td 11px, th 9px).
                          Waagerecht px-5, damit die Spalten unter dem
                          Kartentitel stehen statt 4px daneben. Die Masse stehen
                          je Zelle statt als `[&>td]:`-Variante auf der Zeile:
                          Tailwind erzeugte die td-Variante hier nicht, die
                          Regel fehlte im CSS. Nur diese Tabelle — die geteilte
                          Komponente bleibt unberührt. */}
                      <TableRow>
                        <TableHead
                          className={cn(HEAD_CELL, 'text-2xs uppercase tracking-[0.09em]')}
                        >
                          Mitglied
                        </TableHead>
                        {/* Feste Breiten für die schmalen Spalten, damit die
                            Restbreite dem Namen zufällt. Ohne sie verteilte
                            der Browser die 1060 px der Karte gleichmässig auf
                            drei Spalten — zwischen Uhrzeit und Status stand
                            dann ein Handbreit Nichts. Status rechtsbündig,
                            damit die Zeile eine saubere Aussenkante bekommt. */}
                        <TableHead
                          className={cn(HEAD_CELL, 'w-[30%] text-2xs uppercase tracking-[0.09em]')}
                        >
                          Platz / Zeit
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            'w-[1%] whitespace-nowrap text-right text-2xs uppercase tracking-[0.09em]'
                          )}
                        >
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestBookings.map((b) => (
                        <TableRow key={b.id}>
                          {/* `truncate` wirkt nur in einer begrenzten Zelle,
                              sonst wächst die Tabelle statt zu kürzen — daher
                              max-w auf Mobile plus `whitespace-nowrap` bei
                              Platz/Zeit. Auf 390 px brachen Name und Uhrzeit
                              sonst jeweils zweizeilig um. */}
                          <TableCell
                            className={cn(
                              BODY_CELL,
                              'max-w-[8.5rem] truncate font-semibold sm:max-w-none'
                            )}
                          >
                            {b.memberName}
                          </TableCell>
                          <TableCell className={cn(BODY_CELL, 'whitespace-nowrap text-xs')}>
                            <span className="block font-medium text-foreground">{b.courtName}</span>
                            <span className="block tabular-nums text-muted-foreground">
                              {b.dateTime}
                            </span>
                          </TableCell>
                          <TableCell className={cn(BODY_CELL, 'whitespace-nowrap text-right')}>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 text-xs font-semibold',
                                b.statusTone === 'success' && 'text-primary',
                                b.statusTone === 'warning' && 'text-brand-accent-2',
                                b.statusTone === 'error' && 'text-destructive',
                                b.statusTone === 'default' && 'text-muted-foreground'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-current"
                              />
                              {b.statusLabel}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground px-5 pb-5">
                    Noch keine Buchungen vorhanden.
                  </p>
                )}
                <div className="pb-5" />
              </CardContent>
            </Card>

            <Card className="border border-border dark:border-white/10 shadow-sm p-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                  <IconBox icon={LayoutGrid} size="xs" variant="light" />
                  Platzbelegung diese Woche
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Geplante Sessions und bestätigte Buchungen, {OCCUPANCY_FIRST_HOUR}:00 –{' '}
                  {OCCUPANCY_LAST_HOUR}:00 Uhr
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <CourtOccupancyHeatmap grid={occupancyGrid} />
                <div className="pt-3 flex justify-end">
                  <Link
                    href="/scheduler"
                    className="text-xs font-medium text-muted-foreground hover:text-brand-light transition-colors px-1 py-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Kalender öffnen
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Nebenspalte: erst was drängt (Saison mit Frist), dann was man tut
              (Schnellzugriff), dann was passiert ist (Aktivität). */}
          <div className="lg:col-span-4 space-y-4">
            {seasonProgress && <SeasonProgressCard season={seasonProgress} />}

            <Card className="border border-border dark:border-white/10 shadow-sm p-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold text-foreground dark:text-white">
                  Schnellzugriff
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid gap-2">{smartActions.map(renderSmartAction)}</div>
              </CardContent>
            </Card>

            <Card className="border border-border dark:border-white/10 shadow-sm p-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                  <IconBox icon={Sparkles} size="xs" variant="light" />
                  Aktivität
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <ActivityFeedCompact
                  items={timelineActivity}
                  emptyMessage="Heute ist noch nichts passiert."
                  footerHref={activityFooterHref}
                  footerLabel="Alle Aktivitäten anzeigen"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
