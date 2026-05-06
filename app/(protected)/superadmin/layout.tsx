import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Superadmin Layout — Authentication & Authorization Guard
 *
 * Platform-wide administration area — only accessible by users with 'superadmin' role.
 * This layout ONLY handles auth/role checks.
 * The main navigation sidebar is provided by the parent (protected)/layout.tsx
 * via ProtectedClientLayout + role-aware Sidebar component.
 *
 * Routes:
 * - /superadmin/dashboard - Platform overview
 * - /superadmin/tenants   - All clubs management
 * - /superadmin/clubs     - Create/manage clubs
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
      redirect('/admin/dashboard');
    } else if (roles.includes('trainer')) {
      redirect('/trainer');
    } else {
      redirect('/dashboard');
    }
  }

  return <>{children}</>;
}
