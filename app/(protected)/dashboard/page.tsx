import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

import { createLogger } from '@/lib/logger';

const log = createLogger('dashboard:page');

/**
 * Dashboard Dispatch Page
 *
 * Redirects users to their role-specific area after login — exactly like TSOW:
 *   superadmin → /superadmin (or /superadmin/onboarding if setup not complete)
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
    log.warn('[Dashboard Dispatch] No active memberships for user:', user.id);
    // Do NOT redirect to /member here — that causes a redirect loop when
    // /member also finds no membership and redirects back to /dashboard.
    // Instead, render the member area directly (it handles the no-membership case).
    redirect('/member');
  }

  const roles = memberships.map((m: { role: string }) => m.role);

  // Highest role wins (owner > superadmin > admin > trainer > member)
  if (roles.includes('owner')) {
    redirect('/owner');
  }

  if (roles.includes('superadmin')) {
    redirect('/superadmin');
  }

  if (roles.includes('admin')) {
    redirect('/admin');
  }

  if (roles.includes('trainer')) {
    redirect('/trainer');
  }

  // Default: member — render the member dashboard directly.
  // /member handles its own no-membership state with an onboarding prompt.
  redirect('/member');
}
