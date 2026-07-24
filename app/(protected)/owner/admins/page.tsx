import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { AdminsTableClient, type AdminRow } from './_components/admins-table-client';

export const dynamic = 'force-dynamic';

export default async function OwnerAdminsPage() {
  await requireAuth();
  const sb = createServiceClient();

  // ── Memberships mit role='admin' (alle, inkl. inaktive, damit der Toggle
  //    einen Reaktivierungs-Pfad hat) ──────────────────────────────────────
  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('id, user_id, club_id, role, is_active, clubs(id, name, city, deleted_at)')
    .eq('role', 'admin');

  type AdminMembership = {
    id: string;
    user_id: string;
    club_id: string;
    is_active: boolean;
    clubs: { id: string; name: string; city: string | null; deleted_at: string | null } | null;
  };

  const rowsForTable = ((memberships ?? []) as unknown as AdminMembership[]).filter((m) => {
    // Nur Vereine ohne Soft-Delete zeigen — defensive gegen zukünftige RLS-Drifts.
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    return !!club && !club.deleted_at;
  });

  // ── User-Detail-Profile (Typ + Subscription-Status) ────────────────────
  const userIds = [...new Set(rowsForTable.map((m) => m.user_id))];
  const { data: users } = userIds.length
    ? await sb
        .from('users')
        .select('id, full_name, email, subscription_tier, subscription_status')
        .in('id', userIds)
    : {
        data: [] as Array<{
          id: string;
          full_name: string | null;
          email: string;
          subscription_tier: string | null;
          subscription_status: string | null;
        }>,
      };

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  const rows: AdminRow[] = rowsForTable
    .map((m) => {
      const user = userMap[m.user_id];
      const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
      return {
        membershipId: m.id,
        userId: m.user_id,
        fullName: user?.full_name ?? null,
        email: user?.email ?? '—',
        club: club ? { id: club.id, name: club.name, city: club.city } : null,
        tier: user?.subscription_tier ?? null,
        status: user?.subscription_status ?? null,
        isActive: m.is_active,
      };
    })
    .sort((a, b) => (a.club?.name ?? 'zzz').localeCompare(b.club?.name ?? 'zzz'));

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Alle Club-Admins auf der Plattform — je genau einem Verein zugeordnet. Toggle über die Tabelle reaktiviert/deaktiviert."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {activeCount} aktive / {rows.length} gesamt
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AdminsTableClient rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
