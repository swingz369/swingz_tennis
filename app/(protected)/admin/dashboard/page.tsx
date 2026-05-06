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

    // Determine user's highest role
    const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
    const isAdmin = memberships?.some((m: { role: string }) => m.role === 'admin');

    // CRITICAL: /admin/dashboard is ONLY for superadmins
    // Regular admins should be redirected to their club dashboard
    if (!isSuperadmin) {
      console.log('[Admin Dashboard] Regular admin detected, redirecting to club dashboard');

      // Find admin membership
      const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');

      if (adminMembership) {
        // Redirect admin to their specific club dashboard
        redirect(`/admin/clubs/${adminMembership.club_id}/dashboard`);
      } else if (isAdmin) {
        // Fallback: redirect to first membership's club dashboard
        redirect(`/admin/clubs/${memberships[0].club_id}/dashboard`);
      } else {
        // Not an admin at all, redirect to member dashboard
        redirect('/dashboard');
      }
    }

    console.log('[Admin Dashboard] Superadmin confirmed, showing platform dashboard');

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
