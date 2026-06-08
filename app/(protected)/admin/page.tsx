import { requireAdminClub } from '@/lib/admin-context';
import { formatTime, formatRelativeTime } from '@/lib/format';
import Link from 'next/link';
import {
  Users,
  Calendar,
  CreditCard,
  Clock,
  ChevronRight,
  GraduationCap,
  MapPin,
  Settings,
  AlertTriangle,
  UserPlus,
  Receipt,
  LockKeyhole,
  Activity,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { QuickActions } from '@/components/ui/quick-actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user, clubId, isSuperadmin } = await requireAdminClub();

  // Club info
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status')
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

  // All parallel fetches
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
  ] = await Promise.all([
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true)
      .not('role', 'in', '(trainer,superadmin)'),
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true),
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', false)
      .not('role', 'in', '(trainer,superadmin)'),
    // Today's session count (filtered via schedules → club_id)
    supabase
      .from('sessions')
      .select('id, schedules!inner(club_id)', { count: 'exact', head: true })
      .eq('schedules.club_id', clubId)
      .gte('timeslot_start', todayStart.toISOString())
      .lte('timeslot_start', todayEnd.toISOString()),
    // Today's sessions with court + trainer info (filtered via schedules → club_id)
    supabase
      .from('sessions')
      .select(
        `id, timeslot_start, timeslot_end, courts(name), schedules!inner(club_id), trainers(name)`
      )
      .eq('schedules.club_id', clubId)
      .gte('timeslot_start', todayStart.toISOString())
      .lte('timeslot_start', todayEnd.toISOString())
      .order('timeslot_start', { ascending: true })
      .limit(6),
    // Recent member joins (exclude trainers and superadmins)
    supabase
      .from('user_club_memberships')
      .select('id, created_at, users(full_name, email)')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .not('role', 'in', '(trainer,superadmin)')
      .order('created_at', { ascending: false })
      .limit(3),
    // Recent bookings (filtered by club_id)
    // bookings.member_id has FK to users — PostgREST can resolve users(full_name)
    supabase
      .from('bookings')
      .select('id, created_at, session_start_time, users!bookings_member_id_fkey(full_name)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(3),
    // Monthly revenue from paid invoices (filtered by club_id)
    supabase
      .from('invoices')
      .select('amount')
      .eq('club_id', clubId)
      .eq('status', 'paid')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString()),
    // Total invoice count for billing alert
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
  ]);

  // Calculate monthly revenue
  const monthlyRevenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + (inv.amount ?? 0),
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
    ...(recentMembers ?? []).map((m: any) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return {
        id: `join-${m.id}`,
        type: 'join' as const,
        name: u?.full_name || u?.email || 'Unbekannt',
        created_at: m.created_at,
        sub: 'Neues Mitglied',
      };
    }),
    ...(recentBookings ?? []).map((b: any) => {
      const u = Array.isArray(b.users) ? b.users[0] : b.users;
      return {
        id: `booking-${b.id}`,
        type: 'booking' as const,
        name: u?.full_name || 'Mitglied',
        created_at: b.created_at,
        sub: 'Buchung erstellt',
      };
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Alert Banner — empty billing */}
      {(totalInvoiceCount ?? 0) === 0 && (
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-700/50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <IconBox icon={CreditCard} size="sm" variant="blue" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Noch keine Rechnungen erstellt
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                Erstellen Sie Monatsrechnungen für Ihre {memberCount ?? 0} aktiven Mitglieder
              </p>
            </div>
          </div>
          <Link
            href="/admin/billing"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            Rechnungen erstellen <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Alert Banner — pending approvals */}
      {(pendingApprovals ?? 0) > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-200 dark:border-orange-700/50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <IconBox icon={AlertTriangle} size="sm" variant="orange" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                {pendingApprovals} ausstehende Mitgliedsanfragen
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 truncate">
                Bitte zeitnah bearbeiten, um neue Mitglieder zu aktivieren
              </p>
            </div>
          </div>
          <Link
            href="/admin/approvals"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            Ansehen <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Hallo, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {club.name}
            <span className="mx-2 text-muted-foreground/50">·</span>
            <span
              className={
                isSuperadmin ? 'text-purple-600 dark:text-purple-400' : 'text-brand-accent'
              }
            >
              {isSuperadmin ? 'Superadmin' : 'Admin'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <Link
              href="/select-admin-club"
              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              Verein wechseln <ChevronRight className="h-3 w-3" />
            </Link>
          )}
          <Link
            href="/admin/settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border dark:border-white/10 hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Row — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Mitglieder"
          value={memberCount ?? 0}
          sub="aktive Mitglieder"
          color="blue"
          href="/admin/members"
          animate
        />
        <StatCard
          icon={GraduationCap}
          label="Trainer"
          value={trainerCount ?? 0}
          sub="aktive Trainer"
          color="brand"
          href="/admin/trainers"
          animate
        />
        <StatCard
          icon={Calendar}
          label="Sessions heute"
          value={activeSessions ?? 0}
          sub={new Date().toLocaleDateString('de-DE', { weekday: 'long' })}
          color="purple"
          href="/admin/seasons"
          animate
        />
        <StatCard
          icon={CreditCard}
          label="Monatsumsatz"
          value={
            monthlyRevenue > 0
              ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
                  monthlyRevenue
                )
              : '—'
          }
          sub={new Date().toLocaleDateString('de-DE', { month: 'long' })}
          color="orange"
          href="/admin/billing"
        />
      </div>

      {/* 2-Column Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left 60%: Heute im Verein */}
        <Card className="lg:col-span-3 border border-border dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground dark:text-white">
              <div className="flex items-center gap-2">
                <IconBox icon={Calendar} size="xs" variant="light" />
                Heute im Verein
                {(activeSessions ?? 0) > 0 && (
                  <Badge className="text-[11px] px-1.5 py-0 bg-brand-light/10 text-brand-light border-brand-light/20">
                    {activeSessions}
                  </Badge>
                )}
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
            {(todaySessions ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <IconBox icon={Calendar} size="lg" variant="gray" className="mb-3" />
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                  Keine Sessions heute
                </p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                  Schau morgen wieder vorbei
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-white/5">
                {(todaySessions ?? []).map((s: any) => {
                  const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
                  const trainer = Array.isArray(s.trainers) ? s.trainers[0] : s.trainers;
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <IconBox icon={Clock} size="sm" variant="light" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground dark:text-white truncate">
                          {court?.name ?? 'Platz'}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                          {formatTime(s.timeslot_start)} – {formatTime(s.timeslot_end)}
                          {trainer?.name && (
                            <span className="ml-2 text-muted-foreground">· {trainer.name}</span>
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
          </CardContent>
        </Card>

        {/* Right 40%: Neueste Aktivitäten */}
        <Card className="lg:col-span-2 border border-border dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
              {' '}
              <IconBox icon={Activity} size="xs" variant="blue" />
              Neueste Aktivitäten
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <IconBox icon={Activity} size="lg" variant="gray" className="mb-3" />
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                  Noch keine Aktivitäten
                </p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border dark:divide-white/5">
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
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <QuickActions
        label="Schnellaktionen"
        mode="detailed"
        actions={[
          {
            label: 'Mitglied einladen',
            description: 'Neues Mitglied hinzufügen',
            href: '/admin/members',
            icon: UserPlus,
            variant: 'blue',
          },
          {
            label: 'Session planen',
            description: 'Saisonplanung verwalten',
            href: '/admin/seasons',
            icon: Calendar,
            variant: 'light',
          },
          {
            label: 'Rechnung erstellen',
            description: 'Abrechnungen & Zahlungen',
            href: '/admin/billing',
            icon: Receipt,
            variant: 'orange',
          },
          {
            label: 'Platz sperren',
            description: 'Platzverwaltung öffnen',
            href: '/admin/courts/manage',
            icon: LockKeyhole,
            variant: 'purple',
          },
        ]}
      />

      {/* Secondary Quick Links */}
      <QuickActions
        label="Verwaltung"
        actions={[
          { label: 'Mitglieder', href: '/admin/members', icon: Users, variant: 'blue' },
          { label: 'Trainer', href: '/admin/trainers', icon: GraduationCap, variant: 'light' },
          { label: 'Saisonplanung', href: '/admin/seasons', icon: Calendar, variant: 'green' },
          { label: 'Plätze', href: '/admin/courts', icon: MapPin, variant: 'purple' },
          {
            label: 'Probetrainings',
            href: '/admin/trial-training',
            icon: Sparkles,
            variant: 'amber',
          },
          { label: 'Stundennachweise', href: '/admin/hours-logs', icon: Clock, variant: 'blue' },
          { label: 'Einstellungen', href: '/admin/settings', icon: Settings, variant: 'gray' },
        ]}
      />
    </div>
  );
}
