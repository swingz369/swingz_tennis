import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { SelectAdminClubClient } from './select-admin-club-client';

export const dynamic = 'force-dynamic';

export default async function SelectAdminClubPage() {
  const { supabase, user } = await requireAuth();

  // Only superadmin can access this page — owner selects clubs via /owner/clubs.
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const managedClubIds = (memberships ?? [])
    .filter((m: any) => m.role === 'superadmin' && m.club_id)
    .map((m: any) => m.club_id as string);

  if (managedClubIds.length === 0) redirect('/dashboard');

  // Superadmin sees only the clubs their Tennisschule actually manages.
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, name, status')
    .in('id', managedClubIds)
    .order('name');

  const clubsWithStats = await Promise.all(
    (allClubs ?? []).map(async (club: any) => {
      const [{ count: memberCount }, { count: trainerCount }] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'trainer')
          .eq('is_active', true),
      ]);
      return { ...club, memberCount: memberCount ?? 0, trainerCount: trainerCount ?? 0 };
    })
  );

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <SelectAdminClubClient
      clubs={clubsWithStats}
      userName={profile?.full_name || user.email || 'Superadmin'}
    />
  );
}
