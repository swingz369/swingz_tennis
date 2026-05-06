import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  Users,
  Calendar,
  CreditCard,
  TrendingUp,
  CheckCircle,
  Clock,
  ChevronRight,
  GraduationCap,
  MapPin,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user } = await requireAuth();

  // Get active club from cookie
  const cookieStore = await cookies();
  const clubId = cookieStore.get('admin_club_id')?.value;

  if (!clubId) {
    // Shouldn't happen if layout guard is working, but safety fallback
    redirect('/select-admin-club');
  }

  // Fetch club info
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, status')
    .eq('id', clubId)
    .single();

  if (!club) {
    redirect('/select-admin-club');
  }

  // Check user's role in this club
  const { data: myMembership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();

  const isSuperadmin = myMembership?.role === 'superadmin';

  // Fetch profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Admin';

  // Club stats — all in parallel
  const [
    { count: memberCount },
    { count: trainerCount },
    { count: pendingApprovals },
    { count: activeSessions },
  ] = await Promise.all([
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true),
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true),
    // Pending bookings/approvals
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('status', 'pending'),
    // Sessions today
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('timeslot_start', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lte('timeslot_start', new Date(new Date().setHours(23, 59, 59, 999)).toISOString()),
  ]);

  // Recent members
  const { data: recentMembers } = await supabase
    .from('user_club_memberships')
    .select('id, created_at, users(full_name, email)')
    .eq('club_id', clubId)
    .eq('role', 'member')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hallo, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {club.name} · {isSuperadmin ? 'Superadmin' : 'Admin'}
          </p>
        </div>
        {isSuperadmin && (
          <Link
            href="/select-admin-club"
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            Verein wechseln <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Mitglieder',
            value: memberCount ?? 0,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            href: '/admin/members',
          },
          {
            label: 'Trainer',
            value: trainerCount ?? 0,
            icon: GraduationCap,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
            href: '/admin/trainers',
          },
          {
            label: 'Ausstehende Anfragen',
            value: pendingApprovals ?? 0,
            icon: CheckCircle,
            color: pendingApprovals && pendingApprovals > 0 ? 'text-orange-600' : 'text-gray-500',
            bg:
              pendingApprovals && pendingApprovals > 0
                ? 'bg-orange-50 dark:bg-orange-900/20'
                : 'bg-gray-50 dark:bg-gray-800/20',
            href: '/admin/approvals',
          },
          {
            label: 'Sessions heute',
            value: activeSessions ?? 0,
            icon: Calendar,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            href: '/admin/seasons',
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString('de-DE')}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alerts: pending approvals */}
      {pendingApprovals !== null && pendingApprovals > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-700/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-orange-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  {pendingApprovals} ausstehende Buchungsanfragen
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Bitte zeitnah bearbeiten
                </p>
              </div>
            </div>
            <Link
              href="/admin/approvals"
              className="text-xs font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1"
            >
              Ansehen <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Neue Mitglieder
            <Link
              href="/admin/members"
              className="text-xs text-[#40916C] hover:underline font-normal flex items-center gap-1"
            >
              Alle <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(recentMembers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Noch keine Mitglieder.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {recentMembers!.map((m: any) => {
                const u = Array.isArray(m.users) ? m.users[0] : m.users;
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20 shrink-0">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {u?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u?.full_name || u?.email || 'Unbekannt'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Beigetreten {formatDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Mitglieder', href: '/admin/members', icon: Users },
            { label: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
            { label: 'Saisonplanung', href: '/admin/seasons', icon: Calendar },
            { label: 'Plätze', href: '/admin/courts', icon: MapPin },
            { label: 'Stundennachweise', href: '/admin/hours-logs', icon: Clock },
            { label: 'Einstellungen', href: '/admin/settings', icon: Settings },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#40916C]/40 hover:shadow-sm transition-all bg-white dark:bg-white/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#40916C]/10 shrink-0">
                <action.icon className="h-4 w-4 text-[#40916C]" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
