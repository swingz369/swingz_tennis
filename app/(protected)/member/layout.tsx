import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Member Layout — Authentication & Authorization Guard
 * Members with trainer/admin/superadmin roles are redirected to their appropriate area.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) {
    console.error('[Member Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  // If user has a higher role, send them to the right area
  const roles = (memberships ?? []).map((m: { role: string }) => m.role);

  if (roles.includes('superadmin')) {
    redirect('/superadmin');
  }
  if (roles.includes('admin')) {
    redirect('/admin');
  }
  if (roles.includes('trainer')) {
    redirect('/trainer');
  }

  return <>{children}</>;
}
