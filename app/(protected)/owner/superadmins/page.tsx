import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { SuperadminInviteForm } from './invite-form';
import { PageHeader } from '@/components/ui/page-header';
import {
  SuperadminsTableClient,
  type SuperadminRow,
  type ClubOption,
} from './_components/superadmins-table-client';

export const dynamic = 'force-dynamic';

export default async function OwnerSuperadminsPage() {
  await requireAuth();
  const sb = createServiceClient();

  // ── Aktive UND inaktive Superadmin-Memberships laden ──────────────────
  // Wir sehen auch inaktive, damit der Toggle-Button einen Reaktivierungs-Pfad
  // hat (Soft-Toggle ist reversibel; wir löschen nicht).
  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('id, user_id, club_id, role, is_active, clubs(id, name, city, deleted_at)')
    .eq('role', 'superadmin');

  type SuperMembership = {
    id: string;
    user_id: string;
    club_id: string;
    is_active: boolean;
    clubs: { id: string; name: string; city: string | null; deleted_at: string | null } | null;
  };

  const allMemberships = (memberships ?? []) as unknown as SuperMembership[];
  // Nur Vereine ohne Soft-Delete zeigen — defensive gegen zukünftige RLS-Drifts.
  const rowsForTable = allMemberships.filter((m) => {
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    return !!club && !club.deleted_at;
  });

  const userIds = [...new Set(rowsForTable.map((m) => m.user_id))];
  const { data: users } = userIds.length
    ? await sb.from('users').select('id, full_name, email').in('id', userIds)
    : {
        data: [] as Array<{
          id: string;
          full_name: string | null;
          email: string;
        }>,
      };

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  // ── Pro Superadmin gruppieren: alle Vereine mit membershipId als Anker ─
  const byUser = rowsForTable.reduce<
    Record<
      string,
      {
        user: { id: string; full_name: string | null; email: string };
        memberships: Array<{ membershipId: string; clubs: SuperadminRow['clubs'] }>;
        primaryMembershipId: string | null;
        isActiveAny: boolean;
      }
    >
  >((acc, m) => {
    const user = userMap[m.user_id];
    if (!user) return acc;
    if (!acc[m.user_id]) {
      acc[m.user_id] = {
        user,
        memberships: [],
        primaryMembershipId: null,
        isActiveAny: false,
      };
    }
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    if (m.is_active && !acc[m.user_id].primaryMembershipId) {
      acc[m.user_id].primaryMembershipId = m.id;
    }
    if (m.is_active) acc[m.user_id].isActiveAny = true;
    acc[m.user_id].memberships.push({
      membershipId: m.id,
      clubs: club
        ? [
            {
              membershipId: m.id,
              clubId: club.id,
              clubName: club.name,
              clubCity: club.city,
            },
          ]
        : [],
    });
    return acc;
  }, {});

  const rows: SuperadminRow[] = Object.values(byUser)
    .filter((g) => g.primaryMembershipId !== null) // nur User mit mind. 1 aktiver Row
    .map((g) => {
      const allClubs = g.memberships.flatMap((m) => m.clubs);
      return {
        membershipId: g.primaryMembershipId as string,
        userId: g.user.id,
        fullName: g.user.full_name,
        email: g.user.email,
        clubs: allClubs,
        isActive: g.isActiveAny,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  // ── Alle nicht-gelöschten Clubs für die "Vereinszuweisen"-Auswahl ─────
  const { data: clubs } = await sb
    .from('clubs')
    .select('id, name, city, deleted_at')
    .is('deleted_at', null)
    .order('name');
  const availableClubs: ClubOption[] = (clubs ?? [])
    .filter((c) => !c.deleted_at)
    .map((c) => ({ id: c.id, name: c.name, city: c.city }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Superadmins"
        description="Superadmins verwalten mehrere Vereine (Tennisschule-Chef). Toggle über die Tabelle oder neue Vereine zuweisen."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {rows.length} aktive Superadmin{rows.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SuperadminsTableClient rows={rows} availableClubs={availableClubs} />
        </CardContent>
      </Card>

      <SuperadminInviteForm />
    </div>
  );
}
