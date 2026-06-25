import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OwnerAdminsPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id, club_id, clubs(id, name, city)')
    .eq('role', 'admin')
    .eq('is_active', true);

  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  const { data: users } = userIds.length
    ? await sb
        .from('users')
        .select('id, full_name, email, subscription_tier, subscription_status')
        .in('id', userIds)
    : {
        data: [] as {
          id: string;
          full_name: string | null;
          email: string;
          subscription_tier: string | null;
          subscription_status: string | null;
        }[],
      };

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  const rows = (memberships ?? [])
    .map((m) => ({ user: userMap[m.user_id], club: Array.isArray(m.clubs) ? m.clubs[0] : m.clubs }))
    .sort((a, b) => ((a.club as any)?.name ?? '').localeCompare((b.club as any)?.name ?? ''));

  const tierLabel: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    professional: 'Professional',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Club-Admins auf der Plattform — je genau einem Verein zugeordnet.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {rows.length} aktive{rows.length !== 1 ? ' Admins' : 'r Admin'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-muted-foreground">
              Keine Admins gefunden.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map(({ user, club }, i) => (
                <div
                  key={`${user?.id}-${i}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{user?.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    {club && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {(club as any).name} · {(club as any).city}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Badge variant="outline" className="text-xs">
                      {tierLabel[user?.subscription_tier ?? 'free'] ?? 'Free'}
                    </Badge>
                    <Badge
                      variant={user?.subscription_status === 'active' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {user?.subscription_status === 'active' ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
