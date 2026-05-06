import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AdminPanelV2Client } from './admin-panel-v2-client';
import { analyticsService } from '@/lib/services/analytics-service';

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

  const isAdmin = memberships?.some((m: any) => ['admin', 'superadmin'].includes(m.role));

  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Get the first admin club
  const adminMembership = memberships?.find((m: any) => ['admin', 'superadmin'].includes(m.role));

  if (!adminMembership) {
    redirect('/dashboard');
  }

  const clubId = adminMembership.club_id;
  const clubName = (adminMembership.clubs as any)?.name || 'Admin Panel';

  // Fetch analytics data
  let analyticsMetrics = null;
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
      userRole={adminMembership.role}
    />
  );
}
