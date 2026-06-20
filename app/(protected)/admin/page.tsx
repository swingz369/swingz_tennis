import { requireAdminClub } from '@/lib/admin-context';
import { formatTime, formatRelativeTime } from '@/lib/format';
import Link from 'next/link';
import {
  Users,
  Calendar,
  CreditCard,
  Clock,
  ChevronRight,
  AlertTriangle,
  UserPlus,
  Receipt,
  LockKeyhole,
  Activity,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardTabs } from './dashboard-tabs';
import { AdminHeroHeader } from '@/components/admin-hero-header';
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
        .gte('timeslot_start', todayStart.toISOString())
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
    href: '/admin/courts/manage',
    icon: LockKeyhole,
    variant: 'purple',
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Hero Header ── */}
      <AdminHeroHeader
        firstName={firstName}
        clubName={club.name}
        isSuperadmin={isSuperadmin}
        memberCount={memberCount ?? 0}
        trainerCount={trainerCount ?? 0}
        todaySessionCount={activeSessions ?? 0}
      />

      {/* ── Erste Schritte Checklist — nur kurz nach Onboarding ── */}
      {showChecklist && !checklistDone && (
        <ScrollReveal delay={50}>
          <div className="rounded-2xl border border-brand-light/20 bg-brand-light/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand-light" />
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
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                    {!item.done && (
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* ── Action-First Inbox: only visible when there are actionable tasks ── */}
      <ScrollReveal delay={100}>
        {(needsApprovals || needsBilling) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              Aufmerksamkeit benötigt
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {needsApprovals && (
                <Link
                  href="/admin/members?tab=approvals"
                  className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-200 dark:border-orange-700/50 px-4 py-3 hover:shadow-md transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 shrink-0">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                      {pendingApprovals} ausstehende Anfrage{(pendingApprovals ?? 0) > 1 ? 'n' : ''}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Jetzt bearbeiten und Mitglieder aktivieren
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              )}
              {needsBilling && (
                <Link
                  href="/admin/billing"
                  className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-700/50 px-4 py-3 hover:shadow-md transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Rechnungen ausstehend
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Monatsrechnungen für {memberCount ?? 0} Mitglieder erstellen
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* All-clear state when nothing needs attention */}
        {!needsApprovals && !needsBilling && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/30 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              Alles erledigt — keine offenen Aufgaben.
            </p>
          </div>
        )}
      </ScrollReveal>

      {/* ── Consolidated KPI Summary: 2 cards instead of 4 ── */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Club Overview */}
          <Link href="/admin/members">
            <div className="border border-border dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-2xl hover:border-brand-light/30">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Vereinsübersicht
                  </p>
                  <IconBox
                    icon={Users}
                    size="sm"
                    variant="light"
                    className="group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums">
                      {memberCount ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">Mitglieder</span>
                  </div>
                  <div className="h-4 w-px bg-border dark:bg-white/10" />
                  <div>
                    <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums">
                      {trainerCount ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">Trainer</span>
                  </div>
                  <div className="h-4 w-px bg-border dark:bg-white/10" />
                  <div>
                    <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums">
                      {activeSessions ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">Heute</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-light opacity-0 group-hover:opacity-100 transition-opacity">
                  Mitglieder verwalten <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </Link>

          {/* Finances */}
          <Link href="/admin/billing">
            <div className="border border-border dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-2xl hover:border-orange-200 dark:hover:border-orange-700/50">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Finanzen
                  </p>
                  <IconBox
                    icon={CreditCard}
                    size="sm"
                    variant="orange"
                    className="group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums">
                      {monthlyRevenue > 0
                        ? new Intl.NumberFormat('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                            maximumFractionDigits: 0,
                          }).format(monthlyRevenue)
                        : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      Umsatz {new Date().toLocaleDateString('de-DE', { month: 'short' })}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border dark:bg-white/10" />
                  <div>
                    <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums">
                      {totalInvoiceCount ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">Rechnungen</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrechnung öffnen <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </ScrollReveal>

      {/* ── Merged Panel: Heute im Verein (Sessions + Aktivität) ── */}
      <ScrollReveal delay={300}>
        <Card className="border border-border dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground dark:text-white">
              <div className="flex items-center gap-2">
                <IconBox icon={Calendar} size="xs" variant="light" />
                Heute im Verein
              </div>
              <Link
                href="/admin/seasons"
                className="text-xs font-normal text-brand-light hover:underline flex items-center gap-1"
              >
                Alle Sessions <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <DashboardTabs
              tabs={[
                { key: 'sessions', label: 'Sessions', count: activeSessions ?? 0 },
                { key: 'activity', label: 'Aktivität', count: recentActivity.length },
              ]}
            >
              {/* Tab 0: Today's Sessions */}
              <div className="pt-3">
                {(todaySessions ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <IconBox icon={Calendar} size="lg" variant="gray" className="mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Keine Sessions heute
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Schau morgen wieder vorbei</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border dark:divide-white/5">
                    {(todaySessions ?? []).map((s: Record<string, unknown>) => {
                      const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
                      const trainer = Array.isArray(s.trainers) ? s.trainers[0] : s.trainers;
                      return (
                        <div key={s.id as string} className="flex items-center gap-3 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light/10 shrink-0">
                            <Clock className="h-4 w-4 text-brand-light" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground dark:text-white truncate">
                              {(court as Record<string, string>)?.name ?? 'Platz'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(s.timeslot_start as string)} –{' '}
                              {formatTime(s.timeslot_end as string)}
                              {(trainer as Record<string, string>)?.name && (
                                <span className="ml-2 text-muted-foreground">
                                  · {(trainer as Record<string, string>).name}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge className="shrink-0 text-[11px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/30">
                            Aktiv
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tab 1: Recent Activity */}
              <div className="pt-3">
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <IconBox icon={Activity} size="lg" variant="gray" className="mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Noch keine Aktivitäten
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border dark:divide-white/5">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                            item.type === 'join'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'bg-brand-light/10'
                          }`}
                        >
                          <span
                            className={`text-xs font-semibold ${
                              item.type === 'join'
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-brand-light'
                            }`}
                          >
                            {item.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.sub} · {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                        <div
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            item.type === 'join'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-brand-light/10 text-brand-light'
                          }`}
                        >
                          {item.type === 'join' ? 'Beitritt' : 'Buchung'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DashboardTabs>
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
                  className={`border shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-2xl h-full ${
                    action.urgent
                      ? 'border-orange-200 dark:border-orange-700/40 hover:border-orange-300 dark:hover:border-orange-600/50'
                      : 'border-border dark:border-white/10 hover:border-brand-light/30'
                  }`}
                >
                  <div className="p-4 flex items-start gap-3 h-full">
                    <IconBox
                      icon={action.icon}
                      size="sm"
                      variant={action.variant}
                      className="group-hover:scale-105 transition-transform shrink-0"
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
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-brand-light group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-0.5" />
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
