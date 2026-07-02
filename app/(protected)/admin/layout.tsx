import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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

  return <>{children}</>;
}
