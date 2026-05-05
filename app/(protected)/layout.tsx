import { cookies } from 'next/headers';
import { ProtectedClientLayout } from './protected-client-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';
import { requireAuth } from '@/lib/auth';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Fetch user basic data
  const { data: memberData } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  // Fetch memberships separately to avoid foreign key issues
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles: string[] = (memberships ?? []).map((m: { role: string }) => m.role);
  const isSuperAdmin = roles.includes('superadmin');

  // Get primary club from first active membership
  const primaryMembership = memberships?.[0];
  const primaryClubRaw = primaryMembership?.clubs ?? null;
  const primaryClub = Array.isArray(primaryClubRaw) ? primaryClubRaw[0] : primaryClubRaw;

  // Read selected-club-id cookie for superadmin context
  const cookieStore = await cookies();
  const selectedClubId = cookieStore.get('selected-club-id')?.value;

  let selectedClubData: { id: string; name: string } | null = null;
  if (selectedClubId && isSuperAdmin) {
    const { data: club } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('id', selectedClubId)
      .single();
    selectedClubData = club;
  }

  const userData = {
    name: memberData?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    memberId: memberData?.id,
    club: selectedClubData || (primaryClub ? { id: primaryClub.id, name: primaryClub.name } : null),
    roles,
    selectedClubId: selectedClubId || null,
  };

  return (
    <SentryErrorBoundary>
      <ProtectedRoute>
        <ProtectedClientLayout user={userData}>{children}</ProtectedClientLayout>
      </ProtectedRoute>
    </SentryErrorBoundary>
  );
}
