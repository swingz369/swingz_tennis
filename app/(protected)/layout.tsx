import { cookies } from 'next/headers';
import { ProtectedClientLayout } from './protected-client-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';
import { requireAuth } from '@/lib/auth';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberData } = await supabase
    .from('users')
    .select(
      `
      id,
      email,
      full_name,
      club_memberships (
        role,
        clubs (id, name)
      )
    `
    )
    .eq('id', user.id)
    .maybeSingle();

  const primaryClubRaw = memberData?.club_memberships?.[0]?.clubs ?? null;
  const primaryClub = Array.isArray(primaryClubRaw) ? primaryClubRaw[0] : primaryClubRaw;

  const roles: string[] = (memberData?.club_memberships ?? []).map((m: { role: string }) => m.role);
  const isSuperAdmin = roles.includes('superadmin');

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
    <ProtectedRoute>
      <SentryErrorBoundary>
        <ProtectedClientLayout user={userData}>{children}</ProtectedClientLayout>
      </SentryErrorBoundary>
    </ProtectedRoute>
  );
}
