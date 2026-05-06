import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  Building2,
  Users,
  GraduationCap,
  TrendingUp,
  ChevronRight,
  Activity,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function SuperadminPage() {
  const { supabase, user } = await requireAuth();

  // Platform stats
  const [
    { count: clubCount },
    { count: totalMembers },
    { count: totalTrainers },
    { count: activeMembers },
  ] = await Promise.all([
    supabase.from('clubs').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'trainer')
      .eq('is_active', true),
    supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  // Recent clubs with member counts
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(8);

  // Per-club member counts
  const clubsWithStats = await Promise.all(
    (clubs ?? []).map(async (club: any) => {
      const { count: members } = await supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_active', true);

      const { count: trainers } = await supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'trainer')
        .eq('is_active', true);

      return { ...club, members: members ?? 0, trainers: trainers ?? 0 };
    })
  );

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Willkommen, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Plattform-Übersicht · Superadmin</p>
        </div>
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
        >
          <Shield className="h-3 w-3" />
          Superadmin
        </Badge>
      </div>

      {/* Platform KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Vereine',
            value: clubCount ?? 0,
            icon: Building2,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
          },
          {
            label: 'Nutzer gesamt',
            value: totalMembers ?? 0,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Aktive Mitgliedschaften',
            value: activeMembers ?? 0,
            icon: Activity,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: 'Aktive Trainer',
            value: totalTrainers ?? 0,
            icon: GraduationCap,
            color: 'text-amber-600',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString('de-DE')}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All clubs table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Alle Vereine
            <Link
              href="/superadmin/clubs"
              className="text-xs text-purple-600 hover:underline font-normal flex items-center gap-1"
            >
              Verwalten <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {clubsWithStats.map((club: any) => (
              <div key={club.id} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20 shrink-0">
                  <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{club.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {club.members} Mitglieder · {club.trainers} Trainer
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {club.status === 'inactive' && (
                    <Badge variant="secondary" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                  <Link
                    href={`/select-admin-club?club=${club.id}`}
                    className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 hover:underline"
                  >
                    Verwalten →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Plattform-Verwaltung
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Vereine verwalten', href: '/superadmin/clubs', icon: Building2 },
            { label: 'Vereinsübersicht', href: '/superadmin/tenants', icon: TrendingUp },
            { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
            { label: 'Einstellungen', href: '/admin/settings', icon: Shield },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400/50 hover:shadow-sm transition-all bg-white dark:bg-white/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20 shrink-0">
                <action.icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
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
