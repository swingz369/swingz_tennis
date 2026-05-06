import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Trainer Layout — Authentication & Authorization Guard
 *
 * This layout ONLY handles auth/role checks.
 * The main navigation sidebar is provided by the parent (protected)/layout.tsx
 * via ProtectedClientLayout + role-aware Sidebar component.
 */
export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  // 1. Check authentication
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // 2. Fetch user memberships
  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('id, role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error || !memberships || memberships.length === 0) {
    console.error('[Trainer Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  // 3. Verify trainer, admin, or superadmin role
  const hasTrainerAccess = memberships.some(
    (m: { role: string }) => m.role === 'trainer' || m.role === 'admin' || m.role === 'superadmin'
  );

  if (!hasTrainerAccess) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
