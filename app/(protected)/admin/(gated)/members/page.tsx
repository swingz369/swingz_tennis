import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { MembersClient } from './members-client';
import type { Member } from './member.types';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId, isSuperadmin } = await requireAdminClub();
  const params = await searchParams;
  const { page, offset, limit, search } = getPagination(params, 25);

  // Build query with optional server-side search
  // Exclude trainers from the member list — they have their own admin page at /admin/trainers
  // Exclude superadmins — they are platform-level and should not appear in club member lists
  const excludedRoles = isSuperadmin ? ['trainer'] : ['trainer', 'superadmin'];
  let query = (supabase.from('user_club_memberships') as any)
    .select(
      'id, user_id, role, is_active, is_honorary, honorary_since, joined_at, include_in_planning'
    )
    .eq('club_id', clubId)
    .not('role', 'in', `(${excludedRoles.join(',')})`);

  // Build count query with same filters
  let countQuery = (supabase.from('user_club_memberships') as any)
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .not('role', 'in', `(${excludedRoles.join(',')})`);

  // Apply same search filter to both data + count queries
  if (search) {
    const { data: matchingUsers } = await supabase
      .from('users')
      .select('id')
      .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(500);
    const matchIds = (matchingUsers ?? []).map((u: { id: string }) => u.id);
    if (matchIds.length > 0) {
      query = query.in('user_id', matchIds);
      countQuery = countQuery.in('user_id', matchIds);
    } else {
      // No matches — return empty
      return (
        <MembersClient
          initialMembers={[]}
          clubId={clubId}
          pagination={buildPaginationMeta(page, limit, 0)}
        />
      );
    }
  }

  // Fetch paginated memberships + count
  const [{ data: clubMemberships, error }, { count }] = await Promise.all([
    query.order('joined_at', { ascending: false }).range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    return (
      <div className="p-6 text-error-600">Fehler beim Laden der Mitglieder: {error.message}</div>
    );
  }

  // Fetch user details (match by user_id)
  const userIds = (clubMemberships ?? []).map((m: any) => m.user_id).filter(Boolean);

  const usersMap = new Map<
    string,
    {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
    }
  >();

  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email, phone, address, city')
      .in('id', userIds);

    (usersData ?? []).forEach((u: any) => {
      usersMap.set(u.id, {
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        city: u.city,
      });
    });
  }

  const initialMembers: Member[] = (clubMemberships ?? []).map((m: any) => {
    const userData = usersMap.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      full_name: userData?.full_name || '—',
      email: userData?.email || '—',
      phone: userData?.phone || null,
      address: userData?.address || null,
      city: userData?.city || null,
      role: m.role as Member['role'],
      is_active: m.is_active,
      is_honorary: m.is_honorary ?? false,
      honorary_since: m.honorary_since ?? null,
      include_in_planning: m.include_in_planning ?? true,
      joined_at: m.joined_at,
    };
  });

  const pagination = buildPaginationMeta(page, limit, count);

  return <MembersClient initialMembers={initialMembers} clubId={clubId} pagination={pagination} />;
}
