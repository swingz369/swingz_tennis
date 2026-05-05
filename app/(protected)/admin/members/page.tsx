import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { MembersClient } from './members-client';
import type { Member } from './member.types';

export default async function MembersPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let initialMembers: Member[] = [];
  let clubId: string | null = null;

  if (hasDemoMode) {
    initialMembers = [
      {
        id: '1',
        user_id: '1',
        full_name: 'Max Mustermann',
        email: 'max@example.com',
        role: 'member',
        is_active: true,
        joined_at: '2025-01-15',
      },
      {
        id: '2',
        user_id: '2',
        full_name: 'Anna Schmidt',
        email: 'anna@example.com',
        role: 'member',
        is_active: true,
        joined_at: '2025-02-20',
      },
      {
        id: '3',
        user_id: '3',
        full_name: 'Tom Müller',
        email: 'tom@example.com',
        role: 'trainer',
        is_active: true,
        joined_at: '2025-03-10',
      },
      {
        id: '4',
        user_id: '4',
        full_name: 'Lisa Weber',
        email: 'lisa@example.com',
        role: 'member',
        is_active: false,
        joined_at: '2025-01-05',
      },
    ];
    clubId = 'demo-club';
  } else {
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

    // Determine effective clubId: if superadmin with selected club, use that; else first membership
    const isSuperAdmin = memberships.some((m) => m.role === 'superadmin');
    let effectiveClubId: string;
    if (isSuperAdmin) {
      // Use outer cookieStore
      const selectedClubId = cookieStore.get('selected-club-id')?.value;
      if (selectedClubId && memberships.some((m) => m.club_id === selectedClubId)) {
        effectiveClubId = selectedClubId;
      } else {
        effectiveClubId = memberships[0].club_id;
      }
    } else {
      effectiveClubId = memberships[0].club_id;
    }

    clubId = effectiveClubId;

    // Fetch members for this club
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

    initialMembers = (members || []).map(
      (m: {
        id: string;
        user_id: string;
        role: string;
        is_active: boolean;
        joined_at: string;
        users: { id: string; full_name: string; email: string }[] | null | undefined;
      }) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: m.users?.[0]?.full_name || 'N/A',
        email: m.users?.[0]?.email || 'N/A',
        role: m.role as Member['role'],
        is_active: m.is_active,
        joined_at: m.joined_at,
      })
    );
  }

  return <MembersClient initialMembers={initialMembers} clubId={clubId!} />;
}
