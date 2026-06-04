import { requireAdminClub } from '@/lib/admin-context';
import TrainerProfileManagement from '@/components/trainer-profile-management';

export const dynamic = 'force-dynamic';

export default async function AdminTrainersPage() {
  await requireAdminClub();

  // TrainerProfileManagement is a self-contained client component;
  // it fetches its own data via API routes scoped to the active club.
  return <TrainerProfileManagement />;
}
