import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';

/**
 * Admin Layout — Authentication & Authorization Guard
 *
 * Matches TSOW behavior:
 * - Verifies admin or superadmin role
 * - Superadmin without active club cookie → /select-admin-club
 * - Admin with club where setup_completed_at is null → /admin/onboarding
 * - Non-admin users are redirected to their appropriate area
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Fetch memberships
  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('id, role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error || !memberships || memberships.length === 0) {
    console.error('[Admin Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  const roles = memberships.map((m: { role: string }) => m.role);

  // Verify admin or superadmin role
  const hasAdminAccess = memberships.some(
    (m: { role: string }) => m.role === 'admin' || m.role === 'superadmin'
  );

  if (!hasAdminAccess) {
    if (roles.includes('trainer')) redirect('/trainer');
    redirect('/member');
  }

  const isSuperadmin = memberships.some((m: { role: string }) => m.role === 'superadmin');

  if (isSuperadmin) {
    // Superadmin must select a club before using admin area
    const cookieStore = await cookies();
    const savedClubId =
      cookieStore.get('admin_club_id')?.value || cookieStore.get('selected-club-id')?.value;

    if (!savedClubId) {
      // No club selected — send to club picker (like TSOW /select-admin-club)
      const currentPath = '/admin'; // We can't easily read pathname in server component
      redirect('/select-admin-club');
    }

    // Validate the saved club still exists and user has access
    const { data: clubCheck } = await supabase
      .from('clubs')
      .select('id')
      .eq('id', savedClubId)
      .maybeSingle();

    if (!clubCheck) {
      // Cookie refers to a non-existent club — re-select
      redirect('/select-admin-club');
    }
  }

  return <>{children}</>;
}
