import { redirect } from 'next/navigation';
import { getActiveMemberships } from '@/lib/auth';

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
  // Check if user has superadmin role
  const { data: memberships } = await getActiveMemberships();

  const isOwner = memberships?.some((m: { role: string }) => m.role === 'owner');
  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');

  // Owner gehört in /owner, nicht in /superadmin
  if (isOwner && !isSuperadmin) redirect('/owner');

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

  return <>{children}</>;
}
