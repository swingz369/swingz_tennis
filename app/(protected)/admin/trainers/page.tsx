import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import TrainerProfileManagement from '@/components/trainer-profile-management';

export default async function AdminTrainersPage() {
  const { supabase, user } = await requireAuth();

  // Fetch user's active memberships
  const { data: membershipsData } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const memberships = (membershipsData ?? []) as Array<{ club_id: string | null; role: string }>;

  const isAdminOrSuperadmin = memberships.some(
    (m) => m.role === 'admin' || m.role === 'superadmin'
  );

  if (!isAdminOrSuperadmin) {
    redirect('/dashboard');
  }

  // TrainerProfileManagement is a self-contained client component;
  // it fetches its own data via API routes scoped to the active club.
  return <TrainerProfileManagement />;
}
