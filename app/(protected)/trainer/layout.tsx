import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { TrainerSidebar } from '@/components/layout/trainer-sidebar';

/**
 * Trainer Layout with Authentication Guard
 *
 * Pattern from INTEGRATION_ROADMAP.md Phase 1.3:
 * - Checks authentication at layout level
 * - Verifies trainer, admin, or superadmin role
 * - Redirects non-trainer users to appropriate portal
 * - Provides trainer context to all child routes
 */
export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
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
    console.error('[Trainer Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  // 3. Verify trainer, admin, or superadmin role
  const trainerMemberships = memberships.filter(
    (m: { role: string }) => m.role === 'trainer' || m.role === 'admin' || m.role === 'superadmin'
  );

  if (trainerMemberships.length === 0) {
    // User doesn't have trainer access - redirect to member portal
    const clubData = memberships[0]?.clubs;
    const clubSlug = Array.isArray(clubData) ? clubData[0]?.slug : clubData?.slug;

    if (clubSlug) {
      redirect(`/club/${clubSlug}`);
    }

    // Fallback: no valid role
    redirect('/unauthorized?reason=not_trainer');
  }

  // 4. Determine primary club for trainer
  const primaryMembership = trainerMemberships[0];
  const clubRaw = primaryMembership.clubs;
  const primaryClub = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;

  // 5. Prepare user data for sidebar
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  const userForSidebar = {
    id: user.id,
    email: user.email || '',
    name: userData?.full_name || user.user_metadata?.full_name || 'Trainer',
    avatar: userData?.avatar_url || null,
    role: primaryMembership.role,
  };

  // 6. Check if user is also admin (show admin link in sidebar)
  const isAlsoAdmin = trainerMemberships.some(
    (m: { role: string }) => m.role === 'admin' || m.role === 'superadmin'
  );

  // 7. Render layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <TrainerSidebar
        user={userForSidebar}
        club={primaryClub}
        clubId={primaryMembership.club_id}
        isAlsoAdmin={isAlsoAdmin}
      />
      <main className="flex-1 p-8 lg:ml-64">{children}</main>
    </div>
  );
}
