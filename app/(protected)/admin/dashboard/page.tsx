import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { SuperadminDashboardClient } from './dashboard-client';

export default async function SuperadminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  console.log('User memberships:', memberships);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
  console.log('Is superadmin:', isSuperadmin);

  if (!isSuperadmin) {
    // Fallback: Hardcode admin@swingz.com to Tennis Club Berlin if no memberships found
    if (user.email === 'admin@swingz.com') {
      redirect('/admin/clubs/30b0d39d-a152-4d2d-bd57-d23220794d41/dashboard');
    }
    const adminMembership = memberships?.find((m: any) => m.role === 'admin') || memberships?.[0];
    if (adminMembership) {
      redirect(`/admin/clubs/${adminMembership.club_id}/dashboard`);
    } else {
      redirect('/admin/members');
    }
  }

  const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id, name');

  if (clubsError) {
    console.error('Error fetching clubs:', clubsError);
    // Return empty data on error
    return (
      <SuperadminDashboardClient
        data={{ clubs: [], totalClubs: 0, totalMembers: 0, totalTrainers: 0, totalRevenue: 0 }}
      />
    );
  }

  const clubsData = await Promise.all(
    (clubs || []).map(async (club: { id: string; name: string }) => {
      const { count: members, error: membersError } = await supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'member')
        .eq('is_active', true);

      if (membersError) {
        console.error('Error counting members for club', club.id, membersError);
        return {
          id: club.id,
          name: club.name,
          members: 0,
          trainers: 0,
          revenue: 0,
        };
      }

      const { count: trainers, error: trainersError } = await supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'trainer')
        .eq('is_active', true);

      if (trainersError) {
        console.error('Error counting trainers for club', club.id, trainersError);
        return {
          id: club.id,
          name: club.name,
          members: members || 0,
          trainers: 0,
          revenue: 0,
        };
      }

      return {
        id: club.id,
        name: club.name,
        members: members || 0,
        trainers: trainers || 0,
        revenue: 0,
      };
    })
  );

  const data = {
    clubs: clubsData,
    totalClubs: clubsData.length,
    totalMembers: clubsData.reduce((sum, c) => sum + c.members, 0),
    totalTrainers: clubsData.reduce((sum, c) => sum + c.trainers, 0),
    totalRevenue: clubsData.reduce((sum, c) => sum + c.revenue, 0),
  };

  console.log('Dashboard data:', data);

  return <SuperadminDashboardClient data={data} />;
}
