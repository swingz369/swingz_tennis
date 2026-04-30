import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { DashboardClient } from './dashboard-client';
import type { User } from '@supabase/supabase-js';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let user: User;
  let clubs: Array<{ id: string; name: string; max_members?: number; status?: string }> = [];

  if (hasDemoMode) {
    user = {
      id: 'demo-user-123',
      email: 'demo@swingz.com',
      user_metadata: { full_name: 'Demo User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;
    clubs = [{ id: 'demo-club', name: 'Demo Tennis Club', max_members: 100, status: 'active' }];
  } else {
    const supabase = await createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) redirect('/login');
    user = u;

    console.log('🔍 Dashboard: Fetching clubs for user:', u.email, u.id);

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

    if (memberships && memberships.length > 0) {
      clubs = memberships.map((m: any) => m.clubs).filter((club: any) => club); // filter out nulls
      console.log('Fetched clubs:', clubs);
    } else {
      console.log('No active memberships found for user:', user.email, user.id);
      // Fallback: try to get any club membership regardless of active status
      const { data: anyMemberships } = await supabase
        .from('user_club_memberships')
        .select('club_id, clubs(*)')
        .eq('user_id', user.id)
        .limit(1);
      if (anyMemberships && anyMemberships.length > 0) {
        console.log('Found any membership (possibly inactive):', anyMemberships[0]);
      }
    }

    if (memberships && memberships.length > 0) {
      clubs = memberships.map((m: any) => m.clubs).filter((club: any) => club); // filter out nulls
      console.log('Fetched clubs:', clubs);
    } else {
      console.log('No active memberships found for user:', user.email);
    }
  }

  return <DashboardClient user={user} clubs={clubs} />;
}
