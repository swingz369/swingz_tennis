import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Superadmin-Only Layout
 * Guards /admin/tenants route - only accessible by superadmin role
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Fetch memberships to check role
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');

  if (!isSuperadmin) {
    // Regular admin: redirect to their club dashboard
    const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');

    if (adminMembership) {
      redirect('/admin/panel-v2');
    } else {
      redirect('/dashboard');
    }
  }

  return <>{children}</>;
}
