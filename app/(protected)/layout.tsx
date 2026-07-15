import { cookies } from 'next/headers';
import { ProtectedClientLayout } from './protected-client-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { resolveActiveClub } from '@/lib/auth/resolve-active-club';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Fetch user profile
  const { data: memberData } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  // Fetch memberships (club_id may be NULL for superadmin)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles: string[] = (memberships ?? []).map((m: any) => m.role);
  const isSuperAdmin = roles.includes('superadmin');
  const isAdmin = roles.includes('admin');

  // Collect all clubs (non-null club_ids)
  const allClubs: { id: string; name: string }[] = (memberships ?? [])
    .map((m: any) => {
      const clubRaw = m.clubs;
      const club = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
      return club ? { id: club.id as string, name: club.name as string } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];

  const uniqueClubs = allClubs.filter((c, i, self) => i === self.findIndex((x) => x.id === c.id));

  // Resolve active club:
  //   • Superadmin: PRESERVE LEGACY LOOSE POLICY. The original code trusted
  //     ADMIN_CLUB_COOKIE without membership validation here because the
  //     navbar's `selectedClubId` field is used by the superadmin club-switcher
  //     to display the current club — and superadmin memberships typically
  //     have club_id=NULL (per schema/platform-staff design). Tightening this
  //     would silently de-select the superadmin's UI on cold-SSR F5, breaking
  //     a UX path that exists independently of the admin auth chain.
  //   • Admin: route through the shared helper for single-source-of-truth
  //     alignment with `app/(protected)/admin/(gated)/layout.tsx`,
  //     `lib/admin-context.ts`, and `lib/api-auth.ts`. Admin DOES enforce
  //     membership-match (F5 cold-SSR hang was caused by this branch
  //     diverging in the previous fix).
  //   • Owner: navbar uses service-client lookup outside this layout; here we
  //     return null (no ADMIN_CLUB_COOKIE owner UI to populate).
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;

  let selectedClubId: string | null = null;
  if (isSuperAdmin) {
    selectedClubId = cookieValue || null;
  } else if (isAdmin) {
    const { clubId } = await resolveActiveClub({
      cookieValue,
      memberships: (memberships ?? []).map((m: any) => ({
        role: m.role,
        club_id: m.club_id,
      })),
      highestRole: 'admin',
    });
    selectedClubId = clubId;
  }

  // Cookie-Set im Server Component ist nicht möglich (Next.js 13+).
  // withApiAuth in api-auth.ts setzt ADMIN_CLUB_COOKIE automatisch beim ersten API-Call.

  // Find primary club: prefer selectedClubId, fallback to first membership with a club
  const primaryMembership = selectedClubId
    ? (memberships ?? []).find((m: any) => m.club_id === selectedClubId)
    : (memberships ?? []).find((m: any) => m.club_id);
  const primaryClubRaw = primaryMembership?.clubs ?? null;
  const primaryClub = primaryClubRaw
    ? Array.isArray(primaryClubRaw)
      ? primaryClubRaw[0]
      : primaryClubRaw
    : null;

  const userData = {
    id: user.id,
    name: memberData?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    avatarUrl: memberData?.avatar_url || null,
    memberId: memberData?.id || null,
    club: primaryClub ? { id: primaryClub.id as string, name: primaryClub.name as string } : null,
    clubs: uniqueClubs,
    roles,
    selectedClubId,
  };

  return (
    <ProtectedRoute>
      <ProtectedClientLayout user={userData}>{children}</ProtectedClientLayout>
    </ProtectedRoute>
  );
}
