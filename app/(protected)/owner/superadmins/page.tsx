import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2 } from 'lucide-react';
import { SuperadminInviteForm } from './invite-form';

export const dynamic = 'force-dynamic';

export default async function OwnerSuperadminsPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id, club_id, clubs(id, name, city)')
    .eq('role', 'superadmin')
    .eq('is_active', true);

  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  const { data: users } = userIds.length
    ? await sb.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  const byUser = (memberships ?? []).reduce<
    Record<
      string,
      { user: { id: string; full_name: string | null; email: string }; clubs: string[] }
    >
  >((acc, m) => {
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    if (!acc[m.user_id]) acc[m.user_id] = { user: userMap[m.user_id], clubs: [] };
    if (club) acc[m.user_id].clubs.push(`${(club as any).name} (${(club as any).city})`);
    return acc;
  }, {});

  const rows = Object.values(byUser);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Superadmins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Superadmins verwalten mehrere Vereine (Tennisschule-Chef).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {rows.length} aktive{rows.length !== 1 ? ' Superadmins' : 'r Superadmin'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-muted-foreground">
              Noch keine Superadmins vorhanden.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map(({ user, clubs }) => (
                <div
                  key={user?.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{user?.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    {clubs.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {clubs.join(' · ')}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 ml-4">
                    {clubs.length} Verein{clubs.length !== 1 ? 'e' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SuperadminInviteForm />
    </div>
  );
}
