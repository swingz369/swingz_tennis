import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { resolveActiveClub } from '@/lib/auth/resolve-active-club';
import { getHighestRole } from '@/lib/auth-common';

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

  // Resolve club context via shared helper. Superadmin path is mandatory
  // and redirects to /select-admin-club on missing/stale cookie; admin
  // path is informational-only — gated layout owns the actionable fallback
  // chain (admin-membership → onboarding redirect).
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;
  const highestRole = getHighestRole(roles);
  const { clubId: resolvedClubId, isValid } = await resolveActiveClub({
    cookieValue,
    memberships: memberships ?? [],
    highestRole,
  });

  if (isSuperadmin) {
    // Strict: cookie must exist AND validate against a superadmin membership.
    if (!cookieValue || !isValid || resolvedClubId !== cookieValue) {
      redirect('/select-admin-club');
    }
    // Separate existence check on `clubs` — defends against deleted/renamed clubs.
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('id', cookieValue)
      .maybeSingle();
    if (!club) redirect('/select-admin-club');
  }
  // Admin branch: no redirect — gated layout performs the actionable
  // resolution (membership fallback + onboarding check). Helper call above
  // exists purely for resolution-parity so the admin auth-chain never
  // silently diverges on cold-SSR F5.

  return <>{children}</>;
}
