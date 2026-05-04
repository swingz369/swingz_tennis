import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  if (hasDemoMode) {
    redirect('/admin/analytics');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!memberships || memberships.length === 0) {
    redirect('/login');
  }

  const roles = memberships.map((m: { role: string }) => m.role);
  const highestRole = roles.includes('superadmin')
    ? 'superadmin'
    : roles.includes('admin')
      ? 'admin'
      : roles.includes('trainer')
        ? 'trainer'
        : 'member';

  switch (highestRole) {
    case 'superadmin':
      redirect('/admin/dashboard');
    case 'admin':
      redirect('/admin/analytics');
    case 'trainer':
      redirect('/trainer');
    default:
      redirect('/bookings');
  }
}
