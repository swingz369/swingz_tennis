import { requireAdminClub } from '@/lib/admin-context';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  UserPlus,
  Receipt,
  LockKeyhole,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { PremiumAdminHero } from '@/components/admin/premium-admin-hero';
import { StatCard } from '@/components/ui/stat-card';
import {
  ActivityFeedCompact,
  type TimelineActivityItem,
} from '@/components/admin/activity-feed-compact';
import { AdminInboxBanner, type AttentionAction } from '@/components/admin/admin-inbox-banner';
import { Badge } from '@/components/ui/badge';
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
import { formatAdminTimeHM } from '@/lib/utils/admin-date';

export const dynamic = 'force-dynamic';

// ─── Types ─────────────────────────────────────────────────────────────

// Explicit shape for the awaited `clubs` row. Used as the generic
// argument on `.maybeSingle<T>()` so the page no longer has to cast
// `club` (or its sub-fields) to `any` to satisfy TS strict mode
// (P0-B). Mirrors the columns the page actually reads.
type ClubRow = {
  id: string;
  name: string;
  status: string | null;
  setup_completed_at: string | null;
};

type SmartAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof UserPlus;
  variant: 'blue' | 'orange' | 'purple' | 'light';
  urgent?: boolean;
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
  const { supabase, user, clubId, isSuperadmin } = await requireAdminClub();

  // Club info — explicit generic keeps `setup_completed_at` available
  // without an `any`-cast downstream.
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status, setup_completed_at')
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
    { count: memberCount },
    { count: trainerCount },
    { count: pendingApprovals },
    { count: activeSessions },
    { data: recentMembers },
    { data: recentBookings },
  ] = await Promise.all([
    safe(
      supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true)
        .not('role', 'in', '(trainer,superadmin)')
    ),
    safe(
      supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true)
    ),
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
        .not('role', 'in', '(trainer,superadmin)')
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
    { count: seasonCount },
    { data: priorPaidInvoices },
    { count: priorMemberCount },
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
    safe(
      supabase.from('seasons').select('id', { count: 'exact', head: true }).eq('club_id', clubId)
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
        .not('role', 'in', '(trainer,superadmin)')
        .lte('created_at', priorMonthEnd.toISOString())
    ),
  ]);

  // Monthly revenue (current + prior for honest growth comparison).
  const monthlyRevenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: { amount?: number | null }) => sum + (inv.amount ?? 0),
    0
  );
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
    time: string;
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
        time: formatAdminTimeHM(b.session_start_time as string),
        statusLabel: bookingStatusLabel[status] ?? status,
        statusTone: bookingStatusTone[status] ?? 'default',
      };
    }
  );

  // Onboarding checklist — no `any`-cast: `club.setup_completed_at`
  // is now properly inferred via `ClubRow` (P0-B).
  const setupCompletedAt = club.setup_completed_at ?? null;
  const daysSinceSetup = setupCompletedAt
    ? // eslint-disable-next-line react-hooks/purity -- Server Component: läuft pro Request, nicht pro Re-Render
      (Date.now() - new Date(setupCompletedAt).getTime()) / 86400000
    : null;
  const showChecklist = daysSinceSetup !== null && daysSinceSetup < 30;
  const checklistItems = [
    { label: 'Saison angelegt', done: (seasonCount ?? 0) > 0, href: '/admin/seasons/new' },
    { label: 'Mitglied eingeladen', done: (memberCount ?? 0) > 0, href: '/admin/members' },
    { label: 'Trainer zugewiesen', done: (trainerCount ?? 0) > 0, href: '/admin/trainers' },
    { label: 'Erste Buchung', done: (totalInvoiceCount ?? 0) > 0, href: '/admin/billing' },
  ];
  const checklistDone = checklistItems.every((i) => i.done);

  // Smart actions: determine which contextual actions to show
  const needsApprovals = (pendingApprovals ?? 0) > 0;
  const needsBilling = (totalInvoiceCount ?? 0) === 0;
  const hasSessions = (activeSessions ?? 0) > 0;

  const smartActions: SmartAction[] = [];

  if (needsApprovals) {
    smartActions.push({
      label: `${pendingApprovals} Anfrage${(pendingApprovals ?? 0) > 1 ? 'n' : ''} genehmigen`,
      description: 'Neue Mitgliedsanfragen warten auf dich',
      href: '/admin/members?tab=approvals',
      icon: UserPlus,
      variant: 'orange',
      urgent: true,
    });
  }
  if (needsBilling) {
    smartActions.push({
      label: 'Rechnungen erstellen',
      description: `Monatsabrechnung für ${memberCount ?? 0} Mitglieder`,
      href: '/admin/billing',
      icon: Receipt,
      variant: 'blue',
      urgent: true,
    });
  }
  if (hasSessions) {
    // P0-C fix: singularize when activeSessions === 1.
    smartActions.push({
      label: `${activeSessions === 1 ? '1 Session' : `${activeSessions} Sessions`} überprüfen`,
      description: `${activeSessions === 1 ? '1 Session' : `${activeSessions} Sessions`} heute aktiv`,
      href: '/admin/seasons',
      icon: Calendar,
      variant: 'light',
    });
  }

  smartActions.push({
    label: 'Mitglied einladen',
    description: 'Neues Mitglied zum Verein hinzufügen',
    href: '/admin/members',
    icon: UserPlus,
    variant: 'blue',
  });
  smartActions.push({
    label: 'Platz verwalten',
    description: 'Plätze sperren oder Kalender einsehen',
    href: '/admin/courts',
    icon: LockKeyhole,
    variant: 'purple',
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

  /**
   * Builds a short 5-point ramp ending at `value`, anchored at a starting
   * point derived from the honest growth percentage (P0-A). Falls back to
   * a flat line (all points = value) when no growth signal exists, so
   * the card height stays stable across the four KPIs.
   */
  function buildTrend(value: number, growthPct: number | null = 0): number[] {
    if (!value || value <= 0) return [0, 0, 0, 0, 0];
    const growth = typeof growthPct === 'number' && Number.isFinite(growthPct) ? growthPct : 0;
    const start = value / (1 + growth / 100);
    return [0.25, 0.5, 0.7, 0.9, 1].map((t) => Math.round(start + (value - start) * t));
  }

  const kpiItems = [
    {
      label: 'Mitglieder',
      value: memberCount ?? 0,
      icon: Users,
      color: 'brand' as const,
      // P0-A: honest growth percentage, not hardcoded.
      sub:
        memberGrowthPct === null
          ? 'noch keine Vergleichsdaten'
          : `${memberGrowthPct >= 0 ? '+' : ''}${memberGrowthPct}% zum Vormonat`,
      href: '/admin/members',
      trend: buildTrend(memberCount ?? 0, memberGrowthPct),
    },
    {
      label: 'Heute Sessions',
      value: activeSessions ?? 0,
      icon: Calendar,
      color: hasSessions ? ('orange' as const) : ('gray' as const),
      sub: activeSessions && activeSessions > 0 ? 'live' : 'keine Sessions heute',
      href: '/admin/seasons',
      trend: buildTrend(activeSessions ?? 0),
    },
    {
      label: 'Umsatz ' + new Date().toLocaleDateString('de-DE', { month: 'short' }),
      value: monthlyRevenue > 0 ? `€${monthlyRevenue.toLocaleString('de-DE')}` : '€0',
      icon: CreditCard,
      color: monthlyRevenue > 0 ? ('green' as const) : ('gray' as const),
      // P0-A: honest revenue growth percentage, not hardcoded.
      sub:
        revenueGrowthPct === null
          ? monthlyRevenue > 0
            ? 'noch keine Vergleichsdaten'
            : 'noch keine Zahlung diesen Monat'
          : `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct}% zum Vormonat`,
      href: '/admin/billing',
      trend: buildTrend(monthlyRevenue, revenueGrowthPct),
    },
    {
      label: 'Anfragen offen',
      value: pendingApprovals ?? 0,
      icon: UserPlus,
      color: needsApprovals ? ('orange' as const) : ('gray' as const),
      sub: needsApprovals ? 'wartet auf Prüfung' : 'alles bearbeitet',
      href: '/admin/members?tab=approvals',
      trend: buildTrend(pendingApprovals ?? 0),
    },
  ];

  // Featured KPI — Umsatz (`index 2`) always spans 2 columns of the
  // lg:grid-cols-5 layout, but only gets the accent-border treatment when
  // there's actually revenue to highlight — at €0 the warm accent read
  // as a false alarm next to the neutral "alles erledigt" banner above.
  const FEATURED_KPI_INDEX = 2;

  // Attention actions for InboxBanner
  const attentionActions: AttentionAction[] = [];
  if (needsApprovals) {
    attentionActions.push({
      label: `${pendingApprovals} Anfrage${(pendingApprovals ?? 0) > 1 ? 'n' : ''} genehmigen`,
      description: 'Neue Mitgliedsanfragen warten auf dich',
      href: '/admin/members?tab=approvals',
      icon: UserPlus,
      tone: 'orange',
    });
  }
  if (needsBilling) {
    attentionActions.push({
      label: 'Rechnungen ausstehend',
      description: `Monatsabrechnung für ${memberCount ?? 0} Mitglieder erstellen`,
      href: '/admin/billing',
      icon: CreditCard,
      tone: 'blue',
    });
  }

  // Smart-action card markup — extracted as a closure so the Side-Column
  // layout (P0-D) can render the same cards inside the right Hero column
  // without duplicating the whole JSX block.
  const renderSmartAction = (action: SmartAction) => (
    <Link key={action.href + action.label} href={action.href}>
      <div
        className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
          action.urgent
            ? 'border-brand-accent-200/70 dark:border-brand-accent-700/40 bg-gradient-to-br from-brand-accent-50 via-warning-50 to-background dark:from-brand-accent-900/20 dark:via-warning-900/10 dark:to-card'
            : 'border-border dark:border-white/10 bg-card'
        }`}
      >
        <div className="flex items-start gap-3 h-full relative">
          <IconBox
            icon={action.icon}
            size="sm"
            variant={action.variant}
            className="group-hover:scale-110 transition-transform shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground dark:text-white truncate">
                {action.label}
              </p>
              {action.urgent && (
                <span className="shrink-0 h-2 w-2 rounded-full bg-brand-accent-500 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {action.description}
            </p>
          </div>
          <span className="text-muted-foreground/40 group-hover:text-brand-light group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5 text-base leading-none">
            →
          </span>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* ── Side-Column Hero + Schnellaktionen (war P0-D / P1-G) ──
          SmartActions sitzen jetzt rechts neben dem PremiumAdminHero
          (lg+:col-span-2), sind also sofort über dem Fold. Auf Mobile
          stacken sie sauber unter den Hero. Der redundante
          "Mitglied einladen"-Hero-Button ist entfernt — die Karte unten
          rechts hat denselben CTA ohne Echo. Semantisch liest sich
          die Reihenfolge für Screenreader jetzt: Identifikation →
          Schnellwerkzeuge → dringende Aufgaben → Statistik. */}
      <ScrollReveal>
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
          <div className="lg:col-span-3">
            <PremiumAdminHero
              firstName={firstName}
              clubName={club.name}
              isSuperadmin={isSuperadmin}
              todaySessionCount={activeSessions ?? 0}
            />
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              Schnellaktionen
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {smartActions.map(renderSmartAction)}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Erste Schritte Checklist — nur kurz nach Onboarding ── */}
      {showChecklist && !checklistDone && (
        <ScrollReveal delay={50}>
          <div className="rounded-xl border border-brand-light/20 bg-brand-light/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-light" />
              <p className="text-sm font-semibold text-foreground">Erste Schritte</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {checklistItems.filter((i) => i.done).length}/{checklistItems.length} erledigt
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistItems.map((item) => (
                <Link key={item.label} href={item.done ? '#' : item.href}>
                  <div
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                      item.done
                        ? 'bg-success-50 dark:bg-success-900/20 cursor-default'
                        : 'bg-background border border-border hover:border-brand-light/40 cursor-pointer'
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                        item.done ? 'bg-success-100 dark:bg-success-800' : 'border-2 border-border'
                      }`}
                    >
                      {item.done && (
                        <span className="text-success-600 dark:text-success-400 text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        item.done
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                    {!item.done && <span className="text-muted-foreground ml-auto text-xs">→</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* ── Inbox Banner: attention required ↔ all-clear ── */}
      <ScrollReveal delay={100}>
        {attentionActions.length > 0 ? (
          <AdminInboxBanner variant="urgent" actions={attentionActions} />
        ) : (
          <AdminInboxBanner variant="inbox-zero" />
        )}
      </ScrollReveal>

      {/* ── KPI Grid (5-col asymmetric: featured spans 2, others span 1) ──
          Layout reads as 2 + 1 + 1 + 1 = 5 cols on lg+, 2x2 on mobile/tablet.
          The featured card carries the dashboard's lead metric (Umsatz) and
          receives a top accent stripe + tinted gradient via StatCard. */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiItems.map((item, idx) => (
            <StatCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              sub={item.sub}
              color={item.color}
              href={item.href}
              trend={item.trend}
              animate
              featured={idx === FEATURED_KPI_INDEX && monthlyRevenue > 0}
              className={idx === FEATURED_KPI_INDEX ? 'lg:col-span-2' : undefined}
            />
          ))}
        </div>
      </ScrollReveal>

      {/* ── Letzte Buchungen + Aktivität (zweispaltig) ── */}
      <ScrollReveal delay={300}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          <Card className="lg:col-span-3 border border-border dark:border-white/10 shadow-sm p-0">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                <IconBox icon={Calendar} size="xs" variant="light" />
                Letzte Buchungen
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {latestBookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitglied</TableHead>
                      <TableHead>Platz</TableHead>
                      <TableHead>Zeit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestBookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.memberName}</TableCell>
                        <TableCell className="text-muted-foreground">{b.courtName}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {b.time}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.statusTone} size="sm">
                            {b.statusLabel}
                          </Badge>
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
              <div className="px-5 pt-3 pb-5 flex justify-end">
                <Link
                  href="/bookings"
                  className="text-xs font-medium text-muted-foreground hover:text-brand-light transition-colors px-1 py-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Alle Buchungen anzeigen
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border border-border dark:border-white/10 shadow-sm p-0">
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
      </ScrollReveal>
    </div>
  );
}
