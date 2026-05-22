import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { MembersClient } from './members-client';
import type { Member } from './member.types';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { supabase, user } = await requireAuth();

  // Get user's memberships to determine role
  const { data: myMemberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperAdmin = (myMemberships ?? []).some((m: any) => m.role === 'superadmin');
  const isAdmin = (myMemberships ?? []).some((m: any) => m.role === 'admin');

  if (!isSuperAdmin && !isAdmin) {
    redirect('/dashboard');
  }

  // Determine active club
  let clubId: string | null = null;

  if (isSuperAdmin) {
    const cookieStore = await cookies();
    clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value || null;
    if (!clubId) redirect('/select-admin-club');
  } else {
    const adminMembership = (myMemberships ?? []).find((m: any) => m.role === 'admin');
    clubId = adminMembership?.club_id || null;
    if (!clubId) redirect('/dashboard');
  }

  // Fetch all memberships for this club (include_in_planning not in generated types)
  const { data: clubMemberships, error } = await (supabase
    .from('user_club_memberships') as any)
    .select('id, user_id, role, is_active, joined_at, include_in_planning')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-red-600">Fehler beim Laden der Mitglieder: {error.message}</div>
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
      include_in_planning: m.include_in_planning ?? true,
      joined_at: m.joined_at,
    };
  });

  return <MembersClient initialMembers={initialMembers} clubId={clubId} />;
}
