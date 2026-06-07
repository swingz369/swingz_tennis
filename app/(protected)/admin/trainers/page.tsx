import { requireAdminClub } from '@/lib/admin-context';
import TrainerProfileManagement from '@/components/trainer-profile-management';

export const dynamic = 'force-dynamic';

export default async function AdminTrainersPage() {
  const { clubId } = await requireAdminClub();

  return <TrainerProfileManagement clubId={clubId} />;
}
