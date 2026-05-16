import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user } = await requireAuth();

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles = (memberships ?? []).map((m: any) => m.role as string);
  const isSuperadmin = roles.includes('superadmin');

  let clubId: string | null = null;

  if (isSuperadmin) {
    const cookieStore = await cookies();
    clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value || null;
    if (!clubId) redirect('/select-admin-club');
  } else {
    const adminMembership = (memberships ?? []).find((m: any) => m.role === 'admin');
    clubId = adminMembership?.club_id || null;
    if (!clubId) redirect('/member');
  }

  // Club info
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status')
    .eq('id', clubId)
    .single();

  if (!club) redirect(isSuperadmin ? '/select-admin-club' : '/member');

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
  ] = await Promise.all([
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true),
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
      .eq('is_active', false),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('timeslot_start', todayStart.toISOString())
      .lte('timeslot_start', todayEnd.toISOString()),
    // Today's sessions with court + trainer info
    supabase
      .from('sessions')
      .select(
        `id, timeslot_start, timeslot_end, courts(name), user_club_memberships(users(full_name))`
      )
      .gte('timeslot_start', todayStart.toISOString())
      .lte('timeslot_start', todayEnd.toISOString())
      .order('timeslot_start', { ascending: true })
      .limit(6),
    // Recent member joins
    supabase
      .from('user_club_memberships')
      .select('id, created_at, users(full_name, email)')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3),
    // Recent bookings
    supabase
      .from('bookings')
      .select('id, created_at, session_start_time, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(3),
    // Monthly revenue from paid invoices
    supabase
      .from('invoices')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString()),
  ]);

  // Calculate monthly revenue
  const monthlyRevenue = (paidInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + (inv.amount ?? 0),
    0
  );

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
        name: u?.full_name || 'Unbekannt',
        created_at: b.created_at,
        sub: 'Buchung erstellt',
      };
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `vor ${mins} Min.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `vor ${hrs} Std.`;
    return `vor ${Math.floor(hrs / 24)} Tagen`;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Alert Banner — pending approvals */}
      {(pendingApprovals ?? 0) > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-200 dark:border-orange-700/50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40 shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Hallo, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {club.name}
            <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
            <span
              className={
                isSuperadmin
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-brand-accent dark:text-brand-accent'
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Settings className="h-4 w-4 text-gray-500" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Row — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Mitglieder',
            value: (memberCount ?? 0).toLocaleString('de-DE'),
            icon: Users,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/30',
            border: 'hover:border-blue-200 dark:hover:border-blue-700/50',
            href: '/admin/members',
            sub: 'aktive Mitglieder',
          },
          {
            label: 'Trainer',
            value: (trainerCount ?? 0).toLocaleString('de-DE'),
            icon: GraduationCap,
            color: 'text-brand-light dark:text-brand-light',
            bg: 'bg-brand-light/10 dark:bg-brand-light/20',
            border: 'hover:border-brand-light/30',
            href: '/admin/trainers',
            sub: 'aktive Trainer',
          },
          {
            label: 'Sessions heute',
            value: (activeSessions ?? 0).toLocaleString('de-DE'),
            icon: Calendar,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-900/30',
            border: 'hover:border-purple-200 dark:hover:border-purple-700/50',
            href: '/admin/seasons',
            sub: new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
          },
          {
            label: 'Monatsumsatz',
            value:
              monthlyRevenue > 0
                ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
                    monthlyRevenue
                  )
                : '—',
            icon: CreditCard,
            color: 'text-brand-accent',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            border: 'hover:border-orange-200 dark:hover:border-orange-700/50',
            href: '/admin/billing',
            sub: new Date().toLocaleDateString('de-DE', { month: 'long' }),
          },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group p-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 tabular-nums">
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{kpi.sub}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${kpi.bg} group-hover:scale-105 transition-transform`}
                  >
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 2-Column Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left 60%: Heute im Verein */}
        <Card className="lg:col-span-3 border border-gray-200 dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-gray-900 dark:text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-light/10">
                  <Calendar className="h-3.5 w-3.5 text-brand-light" />
                </div>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-white/5 mb-3">
                  <Calendar className="h-7 w-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Keine Sessions heute
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Schau morgen wieder vorbei
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {(todaySessions ?? []).map((s: any) => {
                  const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
                  const membership = Array.isArray(s.user_club_memberships)
                    ? s.user_club_memberships[0]
                    : s.user_club_memberships;
                  const trainerUser = membership
                    ? Array.isArray(membership.users)
                      ? membership.users[0]
                      : membership.users
                    : null;
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light/10 shrink-0">
                        <Clock className="h-4 w-4 text-brand-light" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {court?.name ?? 'Platz'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(s.timeslot_start)} – {formatTime(s.timeslot_end)}
                          {trainerUser?.full_name && (
                            <span className="ml-2 text-gray-400">· {trainerUser.full_name}</span>
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
        <Card className="lg:col-span-2 border border-gray-200 dark:border-white/10 shadow-sm p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              Neueste Aktivitäten
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-white/5 mb-3">
                  <Activity className="h-7 w-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Noch keine Aktivitäten
                </p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-100 dark:divide-white/5">
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
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {item.sub} · {formatRelative(item.created_at)}
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

      {/* Quick Actions Strip — 4 large action cards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
          Schnellaktionen
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Mitglied einladen',
              desc: 'Neues Mitglied hinzufügen',
              href: '/admin/members',
              icon: UserPlus,
              color: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-50 dark:bg-blue-900/20',
              accent: '#3B82F6',
            },
            {
              label: 'Session planen',
              desc: 'Saisonplanung verwalten',
              href: '/admin/seasons',
              icon: Calendar,
              color: 'text-brand-light dark:text-brand-light',
              bg: 'bg-brand-light/10',
              accent: '#40916C',
            },
            {
              label: 'Rechnung erstellen',
              desc: 'Abrechnungen & Zahlungen',
              href: '/admin/billing',
              icon: Receipt,
              color: 'text-brand-accent',
              bg: 'bg-orange-50 dark:bg-orange-900/20',
              accent: '#FF6B35',
            },
            {
              label: 'Platz sperren',
              desc: 'Platzverwaltung öffnen',
              href: '/admin/courts/manage',
              icon: LockKeyhole,
              color: 'text-purple-600 dark:text-purple-400',
              bg: 'bg-purple-50 dark:bg-purple-900/20',
              accent: '#9333EA',
            },
          ].map((action) => (
            <Link key={action.href + action.label} href={action.href}>
              <Card className="border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group p-0 h-full">
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.bg} group-hover:scale-105 transition-transform`}
                  >
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {action.label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{action.desc}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1">
                    <span className="text-xs font-medium" style={{ color: action.accent }}>
                      Öffnen
                    </span>
                    <ArrowUpRight className="h-3 w-3" style={{ color: action.accent }} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Secondary Quick Links */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Verwaltung
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Mitglieder', href: '/admin/members', icon: Users },
            { label: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
            { label: 'Saisonplanung', href: '/admin/seasons', icon: Calendar },
            { label: 'Plätze', href: '/admin/courts', icon: MapPin },
            { label: 'Stundennachweise', href: '/admin/hours-logs', icon: Clock },
            { label: 'Einstellungen', href: '/admin/settings', icon: Settings },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-brand-light/40 hover:shadow-sm transition-all bg-white dark:bg-white/5 group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light/10 shrink-0">
                <a.icon className="h-4 w-4 text-brand-light" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
