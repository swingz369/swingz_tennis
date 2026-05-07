import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';

/**
 * Admin Layout — Auth + Role Guard
 *
 * Superadmin: muss zuerst einen Verein via /select-admin-club wählen
 *             (cookie admin_club_id muss gesetzt sein)
 * Admin:      hat genau einen Verein zugeordnet — direkt weiter
 * Andere:     werden zu ihrer Rolle weitergeleitet
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('id, role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

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

  // Determine the active clubId for onboarding check
  let activeClubId: string | null = null;

  if (isSuperadmin) {
    // Superadmin needs a club selected to use admin area
    const cookieStore = await cookies();
    const clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value;

    if (!clubId) {
      redirect('/select-admin-club');
    }

    // Validate club still exists
    const { data: club } = await supabase.from('clubs').select('id').eq('id', clubId).maybeSingle();

    if (!club) {
      redirect('/select-admin-club');
    }

    activeClubId = clubId ?? null;
  } else {
    // Admin: get club from membership
    const adminMembership = memberships.find((m: any) => m.role === 'admin');
    activeClubId = adminMembership?.club_id ?? null;
  }

  // Check if onboarding is required — skip if already on /admin/onboarding
  if (activeClubId) {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '';
    const isOnboardingPage = pathname.startsWith('/admin/onboarding');

    if (!isOnboardingPage) {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('setup_completed_at')
        .eq('id', activeClubId)
        .maybeSingle();

      if (clubData && !clubData.setup_completed_at) {
        redirect('/admin/onboarding');
      }
    }
  }

  return <>{children}</>;
}
