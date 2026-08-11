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
  const isOwner = roles.includes('owner');
  const isAdmin = roles.includes('admin');
  // Owner and superadmin are both platform staff: no club-scoped membership
  // row, same "view any club as its admin" access (ROLE_HIERARCHY: owner > superadmin).
  const isPlatformStaff = isSuperadmin || isOwner;

  if (!isPlatformStaff && !isAdmin) {
    if (roles.includes('trainer')) redirect('/trainer');
    redirect('/member');
  }

  // Owner's no-cookie fallback is /owner/clubs (their real selection surface);
  // /select-admin-club is superadmin-only.
  const platformStaffFallback = isOwner ? '/owner/clubs' : '/select-admin-club';

  // Resolve club context via shared helper. Platform-staff path is mandatory
  // and redirects to the fallback above on missing/stale cookie; admin
  // path is informational-only — gated layout owns the actionable fallback
  // chain (admin-membership → onboarding redirect).
  //
  // Only owner uses 'club-exists' (same as lib/api-auth.ts buildAuthContext):
  // owner has no club-scoped membership row at all, so the default
  // 'membership-match' strategy could never resolve a clubId for them.
  // Superadmin uses default 'membership-match' — they hold a real
  // user_club_memberships row (role='superadmin') per managed club, so this
  // correctly scopes them to only their own assigned clubs.
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;
  const highestRole = getHighestRole(roles);
  const { clubId: resolvedClubId, isValid } = await resolveActiveClub({
    cookieValue,
    memberships: memberships ?? [],
    highestRole,
    ...(isOwner
      ? {
          strategy: {
            type: 'club-exists' as const,
            clubExists: async (id) =>
              Boolean((await supabase.from('clubs').select('id').eq('id', id).maybeSingle()).data),
          },
        }
      : {}),
  });

  if (isPlatformStaff) {
    // Strict: cookie must exist AND validate against an existing club.
    if (!cookieValue || !isValid || resolvedClubId !== cookieValue) {
      redirect(platformStaffFallback);
    }
    // Separate existence check on `clubs` — defends against deleted/renamed clubs.
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('id', cookieValue)
      .maybeSingle();
    if (!club) redirect(platformStaffFallback);
  }
  // Admin branch: no redirect — gated layout performs the actionable
  // resolution (membership fallback + onboarding check). Helper call above
  // exists purely for resolution-parity so the admin auth-chain never
  // silently diverges on cold-SSR F5.

  return <>{children}</>;
}
