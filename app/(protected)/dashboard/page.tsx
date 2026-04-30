import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  // Demo mode – return mock data without Supabase
  if (hasDemoMode) {
    const user = {
      id: 'demo-user-123',
      email: 'demo@swingz.com',
      user_metadata: { full_name: 'Demo User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const clubs = [
      { id: 'demo-club', name: 'Demo Tennis Club', max_members: 100, status: 'active' }
    ];

    return <DashboardClient user={user} clubs={clubs} />;
  }

  // Normal Supabase auth flow
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user's clubs with full details using explicit join
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select(
      `
      club_id,
      clubs (
        id,
        name,
        max_members,
        status
      )
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clubs: Array<{ id: string; name: string; max_members?: number; status?: string }> = [];
  if (memberships && memberships.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clubs = memberships.map((m: any) => m.clubs).filter((club: any) => club);
  }

  return <DashboardClient user={user} clubs={clubs} />;
}