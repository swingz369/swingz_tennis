import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AdminPanelV2Client } from './admin-panel-v2-client';
import { analyticsService, type AnalyticsMetrics } from '@/lib/services/analytics-service';

export default async function AdminPanelV2Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get user's club memberships
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // CRITICAL: panel-v2 is SUPERADMIN-ONLY
  // Regular club admins should NOT access this route
  const isSuperadmin = memberships?.some((m: any) => m.role === 'superadmin');

  if (!isSuperadmin) {
    // Regular admin: redirect to their club-specific admin pages
    redirect('/admin/members');
  }

  // Get the first superadmin club
  const superadminMembership = memberships?.find((m: any) => m.role === 'superadmin');

  if (!superadminMembership) {
    redirect('/dashboard');
  }

  const clubId = superadminMembership.club_id;
  const clubName = (superadminMembership.clubs as any)?.name || 'Admin Panel';
  const userRole = superadminMembership.role;

  // Fetch analytics data
  let analyticsMetrics: AnalyticsMetrics | null = null;
  try {
    analyticsMetrics = await analyticsService.getClubAnalytics(clubId);
  } catch (error) {
    console.error('Error fetching analytics:', error);
  }

  return (
    <AdminPanelV2Client
      clubId={clubId}
      clubName={clubName}
      analyticsMetrics={analyticsMetrics}
      userRole={superadminMembership.role}
    />
  );
}
