import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { SuperadminDashboardClient } from './dashboard-client';

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';

export default async function SuperadminDashboardPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login');
    }

    // Sonderfall: admin@swingz.com sofort zum Vereinsdashboard leiten
    if (user.email === 'admin@swingz.com') {
      redirect('/admin/clubs/30b0d39d-a152-4d2d-bd57-d23220794d41/dashboard');
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      throw new Error(`Fehler beim Laden der Mitgliedschaften: ${membershipError.message}`);
    }

    console.log('User memberships:', memberships);

    const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
    console.log('Is superadmin:', isSuperadmin);

    if (!isSuperadmin) {
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
      throw new Error(`Fehler beim Laden der Vereinsdaten: ${clubsError.message}`);
    }

    // Handle empty clubs array
    if (!clubs || clubs.length === 0) {
      const emptyData = {
        clubs: [],
        totalClubs: 0,
        totalMembers: 0,
        totalTrainers: 0,
        totalRevenue: 0,
      };
      console.log('Dashboard data (empty):', emptyData);
      return <SuperadminDashboardClient data={emptyData} />;
    }

    const clubsData = await Promise.all(
      clubs.map(async (club: { id: string; name: string }) => {
        try {
          const { count: members, error: membersError } = await supabase
            .from('user_club_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id)
            .eq('role', 'member')
            .eq('is_active', true);

          if (membersError) {
            console.error('Error counting members for club', club.id, membersError);
          }

          const { count: trainers, error: trainersError } = await supabase
            .from('user_club_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id)
            .eq('role', 'trainer')
            .eq('is_active', true);

          if (trainersError) {
            console.error('Error counting trainers for club', club.id, trainersError);
          }

          return {
            id: club.id,
            name: club.name,
            members: members ?? 0,
            trainers: trainers ?? 0,
            revenue: 0,
          };
        } catch (error) {
          console.error('Error processing club', club.id, error);
          return {
            id: club.id,
            name: club.name,
            members: 0,
            trainers: 0,
            revenue: 0,
          };
        }
      })
    );

    const data = {
      clubs: clubsData,
      totalClubs: clubsData.length,
      totalMembers: clubsData.reduce((sum, c) => sum + (c.members || 0), 0),
      totalTrainers: clubsData.reduce((sum, c) => sum + (c.trainers || 0), 0),
      totalRevenue: clubsData.reduce((sum, c) => sum + (c.revenue || 0), 0),
    };

    console.log('Dashboard data:', data);

    return <SuperadminDashboardClient data={data} />;
  } catch (error) {
    console.error('Dashboard error:', error);
    throw error;
  }
}
