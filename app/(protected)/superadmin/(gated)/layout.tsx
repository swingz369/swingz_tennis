import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

/**
 * Superadmin "gated" route group — everything except /superadmin/onboarding.
 * Sibling (not parent) of onboarding, so this redirect can never loop back
 * into itself: onboarding is structurally outside this layout's subtree.
 */
export default async function SuperadminGatedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: userData } = await supabase
    .from('users')
    .select('superadmin_setup_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData?.superadmin_setup_completed_at) {
    redirect('/superadmin/onboarding');
  }

  return <>{children}</>;
}
