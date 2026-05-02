import { ProtectedClientLayout } from './protected-client-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';
import { requireAuth } from '@/lib/auth';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Normal Supabase auth flow
  const { supabase, user } = await requireAuth();

  // Fetch member profile linked to this auth user
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

  // Extract primary club (first membership)
  const primaryClubRaw = memberData?.club_memberships?.[0]?.clubs ?? null;
  const primaryClub = Array.isArray(primaryClubRaw) ? primaryClubRaw[0] : primaryClubRaw;

  // Collect all roles across club memberships
  const roles: string[] = (memberData?.club_memberships ?? []).map((m: { role: string }) => m.role);

  const userData = {
    name: memberData?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    memberId: memberData?.id,
    club: primaryClub
      ? {
          id: primaryClub.id,
          name: primaryClub.name,
        }
      : null,
    roles,
  };

  return (
    <ProtectedRoute>
      <SentryErrorBoundary>
        <ProtectedClientLayout user={userData}>{children}</ProtectedClientLayout>
      </SentryErrorBoundary>
    </ProtectedRoute>
  );
}
