import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { SuperadminDashboardClient } from './dashboard-client';

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperadminDashboardPage() {
  const emptyData = {
    clubs: [],
    totalClubs: 0,
    totalMembers: 0,
    totalTrainers: 0,
    totalRevenue: 0,
  };

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error('[Admin Dashboard] Failed to create Supabase client:', error);
    return <SuperadminDashboardClient data={emptyData} />;
  }

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
    .eq('user_id', user!.id)
    .eq('is_active', true);

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
    redirect('/dashboard');
  }

  // Determine user's highest role
  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
  const isAdmin = memberships?.some((m: { role: string }) => m.role === 'admin');

  // CRITICAL: /admin/dashboard is ONLY for superadmins
  if (!isSuperadmin) {
    const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');
    if (adminMembership) {
      redirect(`/admin/clubs/${adminMembership.club_id}/dashboard`);
    } else if (isAdmin) {
      redirect(`/admin/clubs/${memberships[0].club_id}/dashboard`);
    } else {
      redirect('/dashboard');
    }
  }

  // Fetch clubs data
  const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id, name');

  if (clubsError) {
    console.error('[Admin Dashboard] Error fetching clubs:', clubsError);
    return <SuperadminDashboardClient data={emptyData} />;
  }

  if (!clubs || clubs.length === 0) {
    return <SuperadminDashboardClient data={emptyData} />;
  }

  // Fetch all memberships in ONE query
  const clubIds = clubs.map((c) => c.id);
  const { data: allMemberships, error: membershipsError } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .in('club_id', clubIds)
    .eq('is_active', true);

  if (membershipsError) {
    console.error('[Admin Dashboard] Error fetching all memberships:', membershipsError);
  }

  // Build lookup map
  const clubStats: Record<string, { members: number; trainers: number }> = {};
  clubIds.forEach((id) => {
    clubStats[id] = { members: 0, trainers: 0 };
  });

  allMemberships?.forEach((membership) => {
    const clubId = membership.club_id;
    if (!clubId) return;
    if (clubStats[clubId]) {
      if (membership.role === 'member') {
        clubStats[clubId].members++;
      } else if (membership.role === 'trainer') {
        clubStats[clubId].trainers++;
      }
    }
  });

  // Fetch revenue per club from paid invoices (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('club_id, amount')
    .in('club_id', clubIds)
    .eq('status', 'paid')
    .gte('paid_at', thirtyDaysAgo.toISOString());

  const revenueMap = new Map<string, number>();
  invoices?.forEach((inv: { club_id: string; amount: number }) => {
    revenueMap.set(inv.club_id, (revenueMap.get(inv.club_id) || 0) + Number(inv.amount));
  });

  const clubsData = clubs.map((club: { id: string; name: string }) => ({
    id: club.id,
    name: club.name,
    members: clubStats[club.id]?.members ?? 0,
    trainers: clubStats[club.id]?.trainers ?? 0,
    revenue: revenueMap.get(club.id) ?? 0,
  }));

  const data = {
    clubs: clubsData,
    totalClubs: clubsData.length,
    totalMembers: clubsData.reduce((sum, c) => sum + (c.members || 0), 0),
    totalTrainers: clubsData.reduce((sum, c) => sum + (c.trainers || 0), 0),
    totalRevenue: clubsData.reduce((sum, c) => sum + (c.revenue || 0), 0),
  };

  return <SuperadminDashboardClient data={data} />;
}
