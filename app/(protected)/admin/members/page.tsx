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
    const selectedClubId = cookieStore.get('selected-club-id')?.value;
    if (selectedClubId && memberships.some((m) => m.club_id === selectedClubId)) {
      effectiveClubId = selectedClubId;
    } else {
      effectiveClubId = memberships[0].club_id;
    }
  } else {
    effectiveClubId = memberships[0].club_id;
  }

  const clubId = effectiveClubId;

  // Fetch members for this club with user details
  const { data: members } = await supabase
    .from('user_club_memberships')
    .select(
      `
      id,
      user_id,
      role,
      is_active,
      joined_at,
      users (
        id,
        full_name,
        email
      )
    `
    )
    .eq('club_id', clubId)
    .order('joined_at', { ascending: false });

  const initialMembers: Member[] = (members || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    full_name: m.users?.[0]?.full_name || 'N/A',
    email: m.users?.[0]?.email || 'N/A',
    role: m.role as Member['role'],
    is_active: m.is_active,
    joined_at: m.joined_at,
  }));

  return <MembersClient initialMembers={initialMembers} clubId={clubId} />;
}
