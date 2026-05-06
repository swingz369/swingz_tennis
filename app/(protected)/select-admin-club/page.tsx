import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { SelectAdminClubClient } from './select-admin-club-client';

export const dynamic = 'force-dynamic';

export default async function SelectAdminClubPage() {
  const { supabase, user } = await requireAuth();

  // Only superadmin can access this page
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: any) => m.role === 'superadmin');

  if (!isSuperadmin) {
    redirect('/dashboard');
  }

  // Fetch ALL clubs (superadmin sees everything)
  const { data: allClubs } = await supabase.from('clubs').select('id, name, status').order('name');

  // Club stats per club
  const clubsWithStats = await Promise.all(
    (allClubs ?? []).map(async (club: any) => {
      const { count: memberCount } = await supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_active', true);

      const { count: trainerCount } = await supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'trainer')
        .eq('is_active', true);

      return {
        ...club,
        memberCount: memberCount ?? 0,
        trainerCount: trainerCount ?? 0,
      };
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
