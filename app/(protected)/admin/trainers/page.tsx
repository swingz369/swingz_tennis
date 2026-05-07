import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
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

  const isSuperadmin = memberships.some((m) => m.role === 'superadmin');

  let clubId: string | null = null;
  if (isSuperadmin) {
    const cookieStore = await cookies();
    const cookieClubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;
    clubId = cookieClubId;
  } else {
    clubId = memberships.find((m) => m.club_id)?.club_id ?? null;
  }

  // TrainerProfileManagement is a self-contained client component;
  // it fetches its own data via API routes scoped to the active club.
  return <TrainerProfileManagement />;
}
