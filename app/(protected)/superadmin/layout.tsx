import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth';

/**
 * Superadmin Layout — Authentication & Authorization Guard + Onboarding Redirect
 *
 * Platform-wide administration area — only accessible by users with 'superadmin' role.
 * On first login, the superadmin is redirected to the onboarding wizard before
 * accessing the dashboard.
 *
 * Routes:
 * - /superadmin           - Dashboard (or /superadmin/onboarding if setup not complete)
 * - /superadmin/dashboard  - Platform overview
 * - /superadmin/tenants    - All clubs management
 * - /superadmin/clubs      - Create/manage clubs
 * - /superadmin/onboarding - First-time setup wizard
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Check if user has superadmin role
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');

  if (!isSuperadmin) {
    // Not a superadmin — redirect based on other roles
    const roles = memberships?.map((m: { role: string }) => m.role) ?? [];

    if (roles.includes('admin')) {
      redirect('/admin/members');
    } else if (roles.includes('trainer')) {
      redirect('/trainer');
    } else {
      redirect('/dashboard');
    }
  }

  // Onboarding check: superadmin must complete setup before accessing dashboard
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? '';
  const isOnboardingPage = pathname.includes('/superadmin/onboarding');

  if (!isOnboardingPage) {
    const { data: userData } = await supabase
      .from('users')
      .select('superadmin_setup_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData?.superadmin_setup_completed_at) {
      redirect('/superadmin/onboarding');
    }
  }

  return <>{children}</>;
}
