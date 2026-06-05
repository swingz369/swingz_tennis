import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';

/**
 * Admin Layout — Auth + Role Guard
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('id, role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('club_id');

  if (error || !memberships || memberships.length === 0) {
    redirect('/login?error=no_memberships');
  }

  const roles = memberships.map((m: any) => m.role as string);
  const isSuperadmin = roles.includes('superadmin');
  const isAdmin = roles.includes('admin');

  if (!isSuperadmin && !isAdmin) {
    if (roles.includes('trainer')) redirect('/trainer');
    redirect('/member');
  }

  if (isSuperadmin) {
    const cookieStore = await cookies();
    const clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value;
    if (!clubId) redirect('/select-admin-club');

    const { data: club } = await supabase.from('clubs').select('id').eq('id', clubId).maybeSingle();
    if (!club) redirect('/select-admin-club');
  }

  // Onboarding check for non-superadmin admins only
  // (superadmin always has access regardless of setup state)
  if (!isSuperadmin && isAdmin) {
    const adminMembership = memberships.find((m: any) => m.role === 'admin');
    const clubId = adminMembership?.club_id;

    if (clubId) {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('setup_completed_at')
        .eq('id', clubId)
        .maybeSingle();

      if (clubData && !clubData.setup_completed_at) {
        const headersList = await headers();
        const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? '';
        const isOnboarding = pathname.includes('/admin/onboarding');
        if (!isOnboarding) {
          redirect('/admin/onboarding');
        }
      }
    }
  }

  return <>{children}</>;
}
