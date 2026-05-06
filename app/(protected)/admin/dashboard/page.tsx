import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { SuperadminDashboardClient } from './dashboard-client';

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperadminDashboardPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error in admin dashboard:', authError);
      redirect('/login');
    }

    // Sonderfall: admin@swingz.com sofort zum Vereinsdashboard leiten
    if (user.email === 'admin@swingz.com') {
      redirect('/admin/clubs/30b0d39d-a152-4d2d-bd57-d23220794d41/dashboard');
    }

    // Fetch memberships with proper error handling
    const { data: memberships, error: membershipError } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      // Don't throw - redirect to safe page
      redirect('/dashboard');
    }

    console.log('[Admin Dashboard] User:', user.email, 'Memberships:', memberships);

    // Check if user has admin/superadmin role
    const hasAdminRole = memberships?.some(
      (m: { role: string }) => m.role === 'superadmin' || m.role === 'admin'
    );

    if (!hasAdminRole) {
      console.log('[Admin Dashboard] User lacks admin role, redirecting');
      // Redirect non-admins to their club dashboard or member area
      const firstMembership = memberships?.[0];
      if (firstMembership) {
        redirect(`/admin/clubs/${firstMembership.club_id}/dashboard`);
      } else {
        redirect('/dashboard');
      }
    }

    // Fetch clubs data with proper error handling
    const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id, name');

    if (clubsError) {
      console.error('[Admin Dashboard] Error fetching clubs:', clubsError);
      // Return empty data instead of crashing
      const emptyData = {
        clubs: [],
        totalClubs: 0,
        totalMembers: 0,
        totalTrainers: 0,
        totalRevenue: 0,
      };
      return <SuperadminDashboardClient data={emptyData} />;
    }

    // Handle empty clubs array
    if (!clubs || clubs.length === 0) {
      console.log('[Admin Dashboard] No clubs found');
      const emptyData = {
        clubs: [],
        totalClubs: 0,
        totalMembers: 0,
        totalTrainers: 0,
        totalRevenue: 0,
      };
      return <SuperadminDashboardClient data={emptyData} />;
    }

    console.log('[Admin Dashboard] Found', clubs.length, 'clubs');

    // Optimize: Fetch all memberships in ONE query instead of N queries (prevents timeout)
    const clubIds = clubs.map((c) => c.id);
    const { data: allMemberships, error: membershipsError } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .in('club_id', clubIds)
      .eq('is_active', true);

    if (membershipsError) {
      console.error('[Admin Dashboard] Error fetching all memberships:', membershipsError);
      // Continue with zero counts instead of failing
    }

    console.log('[Admin Dashboard] Found', allMemberships?.length ?? 0, 'memberships');

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

    console.log('[Admin Dashboard] Final data:', {
      totalClubs: data.totalClubs,
      totalMembers: data.totalMembers,
      totalTrainers: data.totalTrainers,
    });

    return <SuperadminDashboardClient data={data} />;
  } catch (error) {
    console.error('[Admin Dashboard] Unexpected error:', error);
    // Return empty dashboard instead of crashing
    const emptyData = {
      clubs: [],
      totalClubs: 0,
      totalMembers: 0,
      totalTrainers: 0,
      totalRevenue: 0,
    };
    return <SuperadminDashboardClient data={emptyData} />;
  }
}
