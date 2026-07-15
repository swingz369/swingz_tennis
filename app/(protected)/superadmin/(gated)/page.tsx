import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  Building2,
  GraduationCap,
  Activity,
  ChevronRight,
  Shield,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function SuperadminPage() {
  const { supabase, user } = await requireAuth();

  // Nur eigene Gruppe: Clubs aus eigenen Memberships
  const { data: myMemberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const myClubIds = (myMemberships ?? [])
    .map((m: { club_id: string }) => m.club_id)
    .filter(Boolean);

  const clubCount = myClubIds.length;

  const [{ count: totalTrainers }, { count: activeMembers }] = myClubIds.length
    ? await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .in('club_id', myClubIds)
          .eq('role', 'trainer')
          .eq('is_active', true),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .in('club_id', myClubIds)
          .eq('is_active', true),
      ])
    : [{ count: 0 }, { count: 0 }];

  // Nur eigene Clubs
  const { data: clubs } = myClubIds.length
    ? await supabase
        .from('clubs')
        .select('id, name, status, created_at')
        .in('id', myClubIds)
        .order('name')
    : { data: [] };

  const clubsWithStats = await Promise.all(
    (clubs ?? []).map(async (club: any) => {
      const [{ count: members }, { count: trainers }] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'trainer')
          .eq('is_active', true),
      ]);
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Meine Gruppe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hallo {firstName} — {clubCount} Verein{clubCount !== 1 ? 'e' : ''} in deiner Gruppe
          </p>
        </div>
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-info-300 text-info-700 dark:border-info-700 dark:text-info-300"
        >
          <Shield className="h-3 w-3" /> Superadmin
        </Badge>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Vereine (Gruppe)',
            value: clubCount,
            icon: Building2,
            color: 'text-info-600',
            bg: 'bg-info-50 dark:bg-info-900/20',
          },
          {
            label: 'Aktive Mitgliedschaften',
            value: activeMembers ?? 0,
            icon: Activity,
            color: 'text-success-600',
            bg: 'bg-success-50 dark:bg-success-900/20',
          },
          {
            label: 'Aktive Trainer',
            value: totalTrainers ?? 0,
            icon: GraduationCap,
            color: 'text-warning-600',
            bg: 'bg-warning-50 dark:bg-warning-900/20',
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

      {/* All clubs — click to manage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Alle Vereine
            <Link
              href="/superadmin/clubs"
              className="text-xs text-info-600 hover:underline font-normal flex items-center gap-1"
            >
              Verwalten <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border dark:divide-white/10">
            {clubsWithStats.map((club: any) => (
              <div key={club.id} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-50 dark:bg-info-900/20 shrink-0">
                  <Building2 className="h-4 w-4 text-info-600 dark:text-info-400" />
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
                  {/* "Als Admin verwalten" → setzt Cookie + weiter zu /admin */}
                  <Link
                    href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                    className="text-xs text-info-600 hover:text-info-800 dark:text-info-400 hover:underline whitespace-nowrap"
                  >
                    Als Admin →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Superadmin Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Plattform-Verwaltung
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Vereine verwalten', href: '/superadmin/clubs', icon: Building2 },
            { label: 'Vereinsübersicht', href: '/superadmin/tenants', icon: TrendingUp },
            { label: 'Analytics', href: '/admin/analytics', icon: Activity },
            { label: 'Einstellungen', href: '/admin/settings', icon: Settings },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-border dark:border-white/10 hover:border-info-400/50 hover:shadow-sm transition-all bg-background dark:bg-card/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-50 dark:bg-info-900/20 shrink-0">
                <action.icon className="h-4 w-4 text-info-600 dark:text-info-400" />
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
