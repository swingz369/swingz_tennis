import { requireAdminClub } from '@/lib/admin-context';
import { AbsenceManagement } from '@/components/absences/absence-management';

export const dynamic = 'force-dynamic';

export default async function AdminAbsencesPage() {
  const { user } = await requireAdminClub();

  return <AbsenceManagement isAdmin adminUserId={user.id} />;
}
