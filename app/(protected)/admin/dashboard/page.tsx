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

    // Optimize: Fetch all memberships in ONE query instead of N queries (prevents timeout)
    const clubIds = clubs.map((c) => c.id);
    const { data: allMemberships, error: membershipsError } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .in('club_id', clubIds)
      .eq('is_active', true);

    if (membershipsError) {
      console.error('Error fetching all memberships:', membershipsError);
    }

    // Build lookup map for fast access
    const clubStats: Record<string, { members: number; trainers: number }> = {};
    clubIds.forEach((id) => {
      clubStats[id] = { members: 0, trainers: 0 };
    });

    // Count members and trainers per club
    allMemberships?.forEach((membership: { club_id: string; role: string }) => {
      if (clubStats[membership.club_id]) {
        if (membership.role === 'member') {
          clubStats[membership.club_id].members++;
        } else if (membership.role === 'trainer') {
          clubStats[membership.club_id].trainers++;
        }
      }
    });

    // Build clubs data with stats
    const clubsData = clubs.map((club: { id: string; name: string }) => ({
      id: club.id,
      name: club.name,
      members: clubStats[club.id]?.members ?? 0,
      trainers: clubStats[club.id]?.trainers ?? 0,
      revenue: 0,
    }));

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
