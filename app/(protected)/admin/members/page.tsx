import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { MembersClient } from './members-client';
import type { Member } from './member.types';

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get all active club memberships for user
  const { data: membershipsData } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!membershipsData || membershipsData.length === 0) {
    return <div className="p-6 text-red-600">Kein Vereinszugang gefunden</div>;
  }

  const memberships = membershipsData as Array<{ club_id: string; role: string }>;

  // Determine effective clubId: Superadmin uses selected club cookie, non-superadmin uses first membership
  const isSuperAdmin = memberships.some((m) => m.role === 'superadmin');
  let effectiveClubId: string;
  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const selectedClubId = cookieStore.get('admin_club_id')?.value;
    if (selectedClubId && memberships.some((m) => m.club_id === selectedClubId)) {
      effectiveClubId = selectedClubId;
    } else {
      effectiveClubId = memberships[0].club_id;
    }
  } else {
    effectiveClubId = memberships[0].club_id;
  }

  const clubId = effectiveClubId;

  // Fetch members for this club
  const { data: clubMemberships, error: membershipsError } = await supabase
    .from('user_club_memberships')
    .select('id, user_id, role, is_active, joined_at')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: false });

  if (membershipsError) {
    console.error('Error fetching members:', membershipsError);
    return (
      <div className="p-6 text-red-600">
        Fehler beim Laden der Mitglieder: {membershipsError.message}
      </div>
    );
  }

  // Fetch user details separately
  const userIds = (clubMemberships || []).map((m) => m.user_id);
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds);

  // Create a map for quick lookup
  const usersMap = new Map(usersData?.map((u) => [u.id, u]) || []);

  const initialMembers: Member[] = (clubMemberships || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    full_name: usersMap.get(m.user_id)?.full_name || 'N/A',
    email: usersMap.get(m.user_id)?.email || 'N/A',
    role: m.role as Member['role'],
    is_active: m.is_active,
    joined_at: m.joined_at,
  }));

  return <MembersClient initialMembers={initialMembers} clubId={clubId} />;
}
