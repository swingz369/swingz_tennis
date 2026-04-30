import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/infrastructure/external/supabase/server';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { ProtectedRoute } from '@/components/layout/protected-route';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isDemoMode = cookieStore.get('demo-mode');

  // Demo mode bypass – no Supabase auth required
  if (isDemoMode) {
    // Return minimal protected layout with mock user data
    const userData = {
      name: 'Demo User',
      email: 'demo@swingz.com',
      memberId: null,
      club: { id: 'demo-club', name: 'Demo Tennis Club' },
      roles: ['superadmin', 'admin', 'trainer', 'member'],
    };

    return (
      <ProtectedRoute>
        <div className="flex min-h-screen flex-col">
          <Header user={userData} />
          <div className="flex flex-1">
            <Sidebar roles={userData.roles} />
            <main className="flex-1 bg-background p-6 lg:p-8">
              <div className="mx-auto max-w-7xl">{children}</div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Normal Supabase auth flow
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

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
  const primaryClub = memberData?.club_memberships?.[0]?.clubs;

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
      <div className="flex min-h-screen flex-col">
        <Header user={userData} />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
