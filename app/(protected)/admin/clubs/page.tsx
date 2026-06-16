import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { ClubsClient } from './clubs-client';
import type { ClubItem } from './clubs-client';

export const dynamic = 'force-dynamic';

export default async function ClubsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId, isSuperadmin } = await requireAdminClub();
  const params = await searchParams;
  const { page, offset, limit } = getPagination(params, 20);

  let initialClubs: ClubItem[] = [];
  let pagination = buildPaginationMeta(page, limit, 0);
  let errorMsg: string | null = null;

  try {
    // Scope clubs based on role — superadmin sees all, admin sees own club
    let clubsQuery = supabase
      .from('clubs')
      .select('id, name, status, max_members, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isSuperadmin) {
      clubsQuery = clubsQuery.eq('id', clubId);
    }

    const { data: clubs, error, count } = await clubsQuery;

    if (error) {
      errorMsg = error.message;
    } else {
      pagination = buildPaginationMeta(page, limit, count);

      // Fetch member counts for displayed clubs
      const displayedClubIds = (clubs ?? []).map((c: { id: string }) => c.id);
      const memberCounts: Record<string, number> = {};

      if (displayedClubIds.length > 0) {
        const { data: memberships } = await supabase
          .from('user_club_memberships')
          .select('club_id')
          .in('club_id', displayedClubIds)
          .eq('is_active', true);

        (memberships ?? []).forEach((m: { club_id: string | null }) => {
          if (m.club_id) {
            memberCounts[m.club_id] = (memberCounts[m.club_id] || 0) + 1;
          }
        });
      }

      initialClubs = (clubs ?? []).map(
        (c: { id: string; name: string; status: string | null; max_members: number | null }) => ({
          id: c.id,
          name: c.name,
          status: c.status || 'active',
          memberCount: memberCounts[c.id] || 0,
          maxMembers: c.max_members || 100,
        })
      );
    }
  } catch (err) {
    console.error('[ClubsAdminPage] Unexpected error:', err);
    errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
  }

  if (errorMsg) {
    return <div className="p-6 text-red-600">Fehler beim Laden der Vereine: {errorMsg}</div>;
  }

  return <ClubsClient initialClubs={initialClubs} pagination={pagination} searchParams={params} />;
}
