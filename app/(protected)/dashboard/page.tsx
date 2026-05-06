import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { MemberDashboard } from '@/components/dashboard/member-dashboard';
import { TrainerDashboard } from '@/components/dashboard/trainer-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { SuperadminDashboard } from '@/components/dashboard/superadmin-dashboard';

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('No user found in dashboard page');
    redirect('/login');
  }

  // Fetch user's club memberships to determine role
  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching memberships:', error);
    redirect('/login');
  }

  if (!memberships || memberships.length === 0) {
    console.error('No active memberships found for user:', user.id);
    redirect('/login');
  }

  // Fetch user profile for display
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const userDisplay = {
    name: profile?.full_name || user.email?.split('@')[0] || 'User',
    email: profile?.email || user.email || '',
  };

  console.log('Dashboard - User:', user.id, 'Role:', highestRole);

  // Determine highest role
  const roles = memberships.map((m: { role: string }) => m.role);
  const highestRole = roles.includes('superadmin')
    ? 'superadmin'
    : roles.includes('admin')
      ? 'admin'
      : roles.includes('trainer')
        ? 'trainer'
        : 'member';

  console.log('Dashboard - User roles:', roles, 'Highest:', highestRole);

  // Render dynamic dashboard based on role
  switch (highestRole) {
    case 'superadmin':
      return <SuperadminDashboard user={userDisplay} />;
    case 'admin':
      return <AdminDashboard user={userDisplay} />;
    case 'trainer':
      return <TrainerDashboard user={userDisplay} />;
    case 'member':
      return <MemberDashboard user={userDisplay} />;
    default:
      redirect('/login');
  }
}
