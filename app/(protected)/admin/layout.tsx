import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { AdminSidebar } from '@/components/layout/admin-sidebar';

/**
 * Admin Layout with Authentication Guard
 *
 * Pattern from INTEGRATION_ROADMAP.md Phase 1.3:
 * - Checks authentication at layout level
 * - Verifies admin or superadmin role
 * - Redirects non-admin users to appropriate portal
 * - Handles club switching for superadmin users
 * - Provides club context to all child routes
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 1. Check authentication
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // 2. Fetch user memberships
  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select(
      `
      id,
      role,
      club_id,
      is_active,
      clubs (
        id,
        name,
        slug
      )
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error || !memberships || memberships.length === 0) {
    console.error('[Admin Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  // 3. Verify admin or superadmin role
  const adminMemberships = memberships.filter(
    (m: { role: string }) => m.role === 'admin' || m.role === 'superadmin'
  );

  if (adminMemberships.length === 0) {
    // User has membership but not admin role - redirect to their portal
    const roles = memberships.map((m: { role: string }) => m.role);

    if (roles.includes('trainer')) {
      redirect('/trainer');
    }

    if (roles.includes('member')) {
      // Redirect to their club dashboard
      const clubData = memberships[0].clubs;
      const clubSlug = Array.isArray(clubData) ? clubData[0]?.slug : clubData?.slug;
      if (clubSlug) {
        redirect(`/club/${clubSlug}`);
      }
    }

    // Fallback: no valid role
    redirect('/unauthorized?reason=not_admin');
  }

  // 4. Determine active club context
  const isSuperadmin = adminMemberships.some((m: { role: string }) => m.role === 'superadmin');
  let activeClubId: string;
  let activeClubData: { id: string; name: string; slug?: string } | null = null;

  if (isSuperadmin) {
    // Check cookie for persisted club selection
    const cookieStore = await cookies();
    const savedClubId = cookieStore.get('admin_club_id')?.value;

    if (
      savedClubId &&
      adminMemberships.some((m: { club_id: string }) => m.club_id === savedClubId)
    ) {
      activeClubId = savedClubId;
      const activeMembership = adminMemberships.find(
        (m: { club_id: string }) => m.club_id === savedClubId
      );
      const clubRaw = activeMembership?.clubs;
      activeClubData = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
    } else {
      // Default to first club
      activeClubId = adminMemberships[0].club_id;
      const clubRaw = adminMemberships[0].clubs;
      activeClubData = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
    }
  } else {
    // Regular admin: locked to their club
    activeClubId = adminMemberships[0].club_id;
    const clubRaw = adminMemberships[0].clubs;
    activeClubData = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
  }

  // 5. Prepare user data for sidebar
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  const userForSidebar = {
    id: user.id,
    email: user.email || '',
    name: userData?.full_name || user.user_metadata?.full_name || 'Admin',
    avatar: userData?.avatar_url || null,
  };

  // 6. Render layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar
        user={userForSidebar}
        memberships={adminMemberships}
        activeClubId={activeClubId}
        activeClub={activeClubData}
        isSuperadmin={isSuperadmin}
      />
      <main className="flex-1 p-8 lg:ml-64">{children}</main>
    </div>
  );
}
