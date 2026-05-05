import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';

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

  console.log('User memberships:', memberships);

  // Determine highest role
  const roles = memberships.map((m: { role: string }) => m.role);
  const highestRole = roles.includes('superadmin')
    ? 'superadmin'
    : roles.includes('admin')
      ? 'admin'
      : roles.includes('trainer')
        ? 'trainer'
        : 'member';

  console.log('Redirecting user with role:', highestRole);

  // Redirect based on highest role
  switch (highestRole) {
    case 'superadmin':
      redirect('/admin/dashboard'); // Globales Superadmin-Dashboard
    case 'admin':
      redirect('/admin/dashboard'); // Vereinsspezifisches Dashboard (wird in /admin/dashboard/page.tsx weitergeleitet)
    case 'trainer':
      redirect('/trainer');
    case 'member':
      redirect('/bookings');
    default:
      redirect('/login');
  }
}
