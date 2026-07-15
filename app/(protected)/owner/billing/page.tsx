import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Euro, Building2, CheckCircle, Clock, AlertCircle, Users, Wifi } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TIER_LABELS: Record<string, string> = {
  free: 'Kein Abo',
  solo_s: 'Einzelverein S',
  solo_l: 'Einzelverein L',
  school_s: 'Tennisschule S',
  school_l: 'Tennisschule L',
  starter: 'Starter', // legacy
  professional: 'Professional', // legacy
};

const PLAN_PRICES: Record<string, number> = {
  solo_s: 29,
  solo_l: 59,
  school_s: 99,
  school_l: 179,
  starter: 29,
  professional: 79,
};
const STATUS_CFG: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'secondary' | 'error';
    Icon: typeof CheckCircle;
  }
> = {
  active: { label: 'Aktiv', variant: 'success', Icon: CheckCircle },
  trialing: { label: 'Trial', variant: 'warning', Icon: Clock },
  past_due: { label: 'Überfällig', variant: 'error', Icon: AlertCircle },
  inactive: { label: 'Inaktiv', variant: 'secondary', Icon: AlertCircle },
};

export default async function OwnerBillingPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: clubs } = await sb.from('clubs').select('id, name, city, features').order('name');
  const clubIds = (clubs ?? []).map((c) => c.id);

  const { data: adminMemberships } = await sb
    .from('user_club_memberships')
    .select('club_id, user_id')
    .in('club_id', clubIds)
    .eq('role', 'admin')
    .eq('is_active', true);

  const adminUserIds = [...new Set((adminMemberships ?? []).map((m) => m.user_id))];
  const { data: adminUsers } = await sb
    .from('users')
    .select('id, email, subscription_tier, subscription_status, current_period_end')
    .in('id', adminUserIds);

  const userMap = Object.fromEntries((adminUsers ?? []).map((u) => [u.id, u]));
  const clubAdminMap: Record<string, string> = {};
  for (const m of adminMemberships ?? []) {
    if (!clubAdminMap[m.club_id]) clubAdminMap[m.club_id] = m.user_id;
  }

  // 3.6.3: member counts per club
  const { data: allMembers } = await sb
    .from('user_club_memberships')
    .select('club_id')
    .in('club_id', clubIds)
    .eq('role', 'member')
    .eq('is_active', true);

  const memberCountByClub: Record<string, number> = {};
  for (const m of allMembers ?? []) {
    memberCountByClub[m.club_id] = (memberCountByClub[m.club_id] ?? 0) + 1;
  }
  const totalMembers = Object.values(memberCountByClub).reduce((a, b) => a + b, 0);

  const rows = (clubs ?? []).map((club) => ({
    club,
    admin: userMap[clubAdminMap[club.id]] ?? null,
    memberCount: memberCountByClub[club.id] ?? 0,
    hasSmartCourt: !!(club.features as Record<string, unknown> | null)?.['smart_court'],
  }));
  const active = rows.filter(({ admin }) => admin?.subscription_status === 'active').length;
  const smartCourtCount = rows.filter((r) => r.hasSmartCourt).length;
  const mrr = rows.reduce((sum, { admin, hasSmartCourt }) => {
    const tier = admin?.subscription_tier ?? 'free';
    const baseMrr = admin?.subscription_status === 'active' ? (PLAN_PRICES[tier] ?? 0) : 0;
    return sum + baseMrr + (hasSmartCourt ? 79 : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Umsatz & Abos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Abo-Status aller Vereine auf der Plattform
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {(
          [
            { label: 'Vereine gesamt', value: rows.length, Icon: Building2, color: 'brand' },
            { label: 'Aktive Abos', value: active, Icon: CheckCircle, color: 'green' },
            {
              label: 'Premium-Pläne',
              value: rows.filter(({ admin }) =>
                ['solo_l', 'school_l', 'professional'].includes(admin?.subscription_tier ?? '')
              ).length,
              Icon: Euro,
              color: 'purple',
            },
            { label: 'Mitglieder gesamt', value: totalMembers, Icon: Users, color: 'blue' },
            {
              label: 'Smart Court Add-Ons',
              value: smartCourtCount,
              Icon: Wifi,
              color: 'orange',
            },
            { label: 'MRR (ca.)', value: `€ ${mrr}`, Icon: Euro, color: 'green' },
          ] as const
        ).map(({ label, value, Icon, color }) => (
          <StatCard key={label} icon={Icon} label={label} value={value} color={color} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Alle Vereine</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {rows.map(({ club, admin, memberCount, hasSmartCourt }) => {
              const tier = admin?.subscription_tier ?? 'free';
              const status = admin?.subscription_status ?? 'inactive';
              const cfg = STATUS_CFG[status] ?? STATUS_CFG.inactive;
              return (
                <div
                  key={club.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{club.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {club.city} · {admin?.email ?? 'kein Admin'} · {memberCount} Mitglieder
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasSmartCourt && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-xs text-brand-accent-600 border-brand-accent-300 dark:text-brand-accent-400 dark:border-brand-accent-700/50"
                      >
                        <Wifi className="h-3 w-3" />
                        Smart Court
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {TIER_LABELS[tier] ?? tier}
                    </Badge>
                    <Badge variant={cfg.variant} className="gap-1 text-xs">
                      <cfg.Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                    {admin?.current_period_end && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        bis {new Date(admin.current_period_end).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
