import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import Link from 'next/link';
import {
  Building2,
  Users,
  GraduationCap,
  Activity,
  ChevronRight,
  Shield,
  UserCog,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const { user } = await requireAuth();
  // Service client bypasses RLS — needed for platform-wide stats before owner RLS policies are applied
  const sb = createServiceClient();

  const [
    { count: clubCount },
    { count: totalUsers },
    { count: superadminCount },
    { count: adminCount },
  ] = await Promise.all([
    sb.from('clubs').select('id', { count: 'exact', head: true }),
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'superadmin')
      .eq('is_active', true),
    sb
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true),
  ]);

  const { data: clubs } = await sb
    .from('clubs')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: profile } = await sb
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(' ')[0] || 'Owner';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Plattform-Übersicht"
          description={<>Hallo {firstName} — Swingz Plattform-Dashboard</>}
        />
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-info-300 text-info-700 dark:border-info-700 dark:text-info-300"
        >
          <Shield className="h-3 w-3" /> Owner
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            { label: 'Vereine gesamt', value: clubCount ?? 0, icon: Building2, color: 'brand' },
            { label: 'Nutzer gesamt', value: totalUsers ?? 0, icon: Users, color: 'blue' },
            {
              label: 'Superadmins',
              value: superadminCount ?? 0,
              icon: UserCog,
              color: 'purple',
            },
            { label: 'Admins', value: adminCount ?? 0, icon: GraduationCap, color: 'green' },
          ] as const
        ).map((stat) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value.toLocaleString('de-DE')}
            color={stat.color}
          />
        ))}
      </div>

      {/* Alle Vereine */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Vereine
            <div className="flex items-center gap-2">
              <Link href="/owner/clubs?new=1">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Verein anlegen
                </Button>
              </Link>
              <Link
                href="/owner/clubs"
                className="text-xs text-info-600 hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border dark:divide-white/10">
            {(clubs ?? []).map((club: any) => (
              <div key={club.id} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-50 dark:bg-info-900/20 shrink-0">
                  <Building2 className="h-4 w-4 text-info-600 dark:text-info-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{club.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(club.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {club.status === 'inactive' && (
                    <Badge variant="secondary" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                  <Link
                    href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                    className="text-xs text-info-600 hover:text-info-800 dark:text-info-400 hover:underline whitespace-nowrap"
                  >
                    Als Admin →
                  </Link>
                </div>
              </div>
            ))}
            {(clubs ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Noch keine Vereine angelegt.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schnellaktionen */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Schnellaktionen
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Verein anlegen', href: '/owner/clubs?new=1', icon: Building2 },
            { label: 'Admin einladen', href: '/owner/clubs', icon: UserCog },
            { label: 'Alle Vereine', href: '/owner/clubs', icon: Activity },
            { label: 'Superadmins', href: '/owner/superadmins', icon: Shield },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-border dark:border-white/10 hover:border-info-400/50 hover:shadow-sm transition-all bg-background dark:bg-card/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-50 dark:bg-info-900/20 shrink-0">
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
