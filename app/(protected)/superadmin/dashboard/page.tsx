import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AdminPanelV2Client } from './admin-panel-v2-client';
import { analyticsService, type AnalyticsMetrics } from '@/lib/services/analytics-service';

/**
 * Superadmin Dashboard Page
 * Platform-wide overview for superadmins
 * RBAC enforced by layout.tsx
 */
export default async function SuperadminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get user's first superadmin club membership
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .eq('is_active', true);

  const superadminMembership = memberships?.[0];

  if (!superadminMembership) {
    redirect('/dashboard');
  }

  const clubId = superadminMembership.club_id;
  const clubName = (superadminMembership.clubs as any)?.name || 'Platform Dashboard';

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
      userRole="superadmin"
    />
  );
}
