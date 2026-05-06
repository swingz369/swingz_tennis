import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Dashboard Dispatch Page
 *
 * Redirects users to their role-specific area after login — exactly like TSOW:
 *   superadmin → /superadmin
 *   admin      → /admin (or /admin/onboarding if setup not complete)
 *   trainer    → /trainer
 *   member     → /member
 */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth();

  // Fetch active memberships to determine highest role
  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error || !memberships || memberships.length === 0) {
    console.warn('[Dashboard Dispatch] No active memberships for user:', user.id);
    // Show member area with onboarding hint
    redirect('/member');
  }

  const roles = memberships.map((m: { role: string }) => m.role);

  // Highest role wins (superadmin > admin > trainer > member)
  if (roles.includes('superadmin')) {
    redirect('/superadmin');
  }

  if (roles.includes('admin')) {
    redirect('/admin');
  }

  if (roles.includes('trainer')) {
    redirect('/trainer');
  }

  // Default: member
  redirect('/member');
}
