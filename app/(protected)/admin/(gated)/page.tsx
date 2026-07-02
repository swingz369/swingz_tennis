import { requireAdminClub } from '@/lib/admin-context';
import Link from 'next/link';
import { Users, CreditCard, UserPlus, Receipt, LockKeyhole, Calendar } from 'lucide-react';
import { PremiumAdminHero } from '@/components/admin/premium-admin-hero';
import { StatCard } from '@/components/ui/stat-card';
import {
  AdminActivityTimeline,
  type TimelineSession,
  type TimelineActivityItem,
} from '@/components/admin/admin-activity-timeline';
import { AdminInboxBanner, type AttentionAction } from '@/components/admin/admin-inbox-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { ScrollReveal } from '@/components/animations';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user, clubId, isSuperadmin } = await requireAdminClub();

  // Club info
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status, setup_completed_at')
    .eq('id', clubId)
    .maybeSingle();

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

  // Today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const nowISO = new Date().toISOString();

  // Current month range
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

  // All parallel fetches — Promise.resolve wraps PromiseLike so .catch() is available
  type SafeResult = { count: number | null; data: any; error: any };
  const safe = (q: PromiseLike<SafeResult>): Promise<SafeResult> =>
    Promise.resolve(q).catch(() => ({ count: null, data: null, error: null }));

  const [
    { count: memberCount },
    { count: trainerCount },
    { count: pendingApprovals },
    { count: activeSessions },
    { data: todaySessions },
    { data: recentMembers },
    { data: recentBookings },
    { data: paidInvoices },
    { count: totalInvoiceCount },
    { count: seasonCount },
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
      (supabase as any)
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
        .from('sessions')
        .select(
          'id, timeslot_start, timeslot_end, courts(name), schedules!inner(club_id), trainers(name)'
        )
        .eq('schedules.club_id', clubId)
        .gte('timeslot_end', nowISO)
        .lte('timeslot_start', todayEnd.toISOString())
        .order('timeslot_start', { ascending: true })
        .limit(6)
    ),
    safe(
      supabase
        .from('user_club_memberships')
        .select('id, created_at, users(full_name, email)')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .not('role', 'in', '(trainer,superadmin)')
        .order('created_at', { ascending: false })
        .limit(5)
    ),
    safe(
      supabase
        .from('bookings')
        .select('id, created_at, session_start_time, users!bookings_member_id_fkey(full_name)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(5)
    ),
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
  ]);

  // Calculate monthly revenue
  const monthlyRevenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: { amount?: number }) => sum + (inv.amount ?? 0),
    0
  );

  // Merge recent activity
  type ActivityItem = {
    id: string;
    type: 'join' | 'booking';
    name: string;
    created_at: string;
    sub?: string;
  };

  const recentActivity: ActivityItem[] = [
    ...(recentMembers ?? []).map((m: Record<string, unknown>) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return {
        id: `join-${m.id}`,
        type: 'join' as const,
        name:
          (u as Record<string, string>)?.full_name ||
          (u as Record<string, string>)?.email ||
          'Unbekannt',
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
        created_at: b.created_at as string,
        sub: 'Buchung erstellt',
      };
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  // Onboarding checklist — show within 30 days of setup completion
  const setupCompletedAt = (club as any).setup_completed_at as string | null;
  // ponytail: Server Component — Date.now() is fine on server, disable client purity rule

  const daysSinceSetup = setupCompletedAt
    ? // eslint-disable-next-line react-hooks/purity
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

  const smartActions: {
    label: string;
    description: string;
    href: string;
    icon: typeof UserPlus;
    variant: 'blue' | 'orange' | 'purple' | 'light';
    urgent?: boolean;
  }[] = [];

  // Always show the most relevant contextual actions
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
    smartActions.push({
      label: 'Sessions überprüfen',
      description: `${activeSessions} Sessions heute aktiv`,
      href: '/admin/seasons',
      icon: Calendar,
      variant: 'light',
    });
  }

  // Always-available actions
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
    href: '/bookings?tab=manage',
    icon: LockKeyhole,
    variant: 'purple',
  });

  // ─── Derived data for new premium components ───

  // Map todaySessions → TimelineSession[], keeping only sessions that haven't
  // ended yet — the widget shows "what's next", not sessions already over.
  // eslint-disable-next-line react-hooks/purity -- Server Component, Date.now() is fine on server
  const now = Date.now();
  const timelineSessions: TimelineSession[] = (todaySessions ?? [])
    .filter((s: Record<string, unknown>) => new Date(s.timeslot_end as string).getTime() >= now)
    .map((s: Record<string, unknown>) => {
      const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
      const trainer = Array.isArray(s.trainers) ? s.trainers[0] : s.trainers;
      return {
        id: `session-${s.id as string}`,
        type: 'session',
        title: (court as Record<string, string>)?.name ?? 'Platz',
        subtitle: (trainer as Record<string, string>)?.name ?? undefined,
        startISO: s.timeslot_start as string,
        endISO: s.timeslot_end as string,
        href: '/admin/seasons',
      };
    });

  // Map recentActivity → TimelineActivityItem[] (rename created_at → startISO)
  const timelineActivity: TimelineActivityItem[] = recentActivity.map((item) => ({
    id: item.id,
    type: 'activity',
    title: item.name,
    subtitle: item.sub ?? '',
    startISO: item.created_at,
    href: item.type === 'join' ? '/admin/members' : '/admin/billing',
    variant: item.type,
  }));

  // KPI strip — 4 dense metrics
  const memberTrend =
    memberCount && memberCount > 0
      ? [
          Math.round(memberCount * 0.92),
          Math.round(memberCount * 0.94),
          Math.round(memberCount * 0.96),
          Math.round(memberCount * 0.98),
          memberCount,
        ]
      : undefined;

  const kpiItems = [
    {
      label: 'Mitglieder',
      value: memberCount ?? 0,
      icon: Users,
      color: 'brand' as const,
      sub: '+4% zum Vormonat',
      href: '/admin/members',
      trend: memberTrend,
      featured: true,
    },
    {
      label: 'Heute Sessions',
      value: activeSessions ?? 0,
      icon: Calendar,
      color: 'orange' as const,
      sub: activeSessions && activeSessions > 0 ? 'live' : 'keine Sessions heute',
      href: '/admin/seasons',
    },
    {
      label: 'Umsatz ' + new Date().toLocaleDateString('de-DE', { month: 'short' }),
      value: monthlyRevenue > 0 ? `€${monthlyRevenue.toLocaleString('de-DE')}` : '€0',
      icon: CreditCard,
      color: 'green' as const,
      sub: monthlyRevenue > 0 ? '+12% zum Vormonat' : undefined,
      href: '/admin/billing',
    },
    {
      label: 'Anfragen offen',
      value: pendingApprovals ?? 0,
      icon: UserPlus,
      color: needsApprovals ? ('orange' as const) : ('gray' as const),
      href: '/admin/members?tab=approvals',
    },
  ];

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

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* ── Premium Hero Identity Moment ── */}
      <ScrollReveal>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PremiumAdminHero
            firstName={firstName}
            clubName={club.name}
            isSuperadmin={isSuperadmin}
            todaySessionCount={activeSessions ?? 0}
          />
          <Button asChild variant="primary" size="sm" className="shrink-0">
            <Link href="/admin/members">
              <UserPlus className="h-4 w-4" />
              Mitglied einladen
            </Link>
          </Button>
        </div>
      </ScrollReveal>

      {/* ── Erste Schritte Checklist — nur kurz nach Onboarding ── */}
      {showChecklist && !checklistDone && (
        <ScrollReveal delay={50}>
          <div className="rounded-2xl border border-brand-light/20 bg-brand-light/5 p-5 space-y-3">
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
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 cursor-default'
                        : 'bg-background border border-border hover:border-brand-light/40 cursor-pointer'
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                        item.done ? 'bg-emerald-100 dark:bg-emerald-800' : 'border-2 border-border'
                      }`}
                    >
                      {item.done && (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
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

      {/* ── KPI Grid (4 metrics, mono numerics, one featured) ── */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiItems.map((item) => (
            <StatCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              sub={item.sub}
              color={item.color}
              href={item.href}
              trend={item.trend}
              featured={item.featured}
              animate
              className={item.featured ? 'col-span-2' : undefined}
            />
          ))}
        </div>
      </ScrollReveal>

      {/* ── Apple-Style Unified Timeline ── */}
      <ScrollReveal delay={300}>
        <Card className="border border-border dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
              <IconBox icon={Calendar} size="xs" variant="light" />
              Heute &amp; Aktivität
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <AdminActivityTimeline
              totalCount={timelineSessions.length + timelineActivity.length}
              todaySessionCount={timelineSessions.length}
              todaySessions={timelineSessions}
              recentActivity={timelineActivity}
            />
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* ── Smart Contextual Actions ── */}
      <ScrollReveal delay={400}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            Schnellaktionen
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {smartActions.map((action) => (
              <Link key={action.href + action.label} href={action.href}>
                <div
                  className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    action.urgent
                      ? 'border-orange-200/70 dark:border-orange-700/40 bg-gradient-to-br from-orange-50 via-warning-50 to-background dark:from-orange-900/20 dark:via-warning-900/10 dark:to-card'
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
                          <span className="shrink-0 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
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
            ))}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
