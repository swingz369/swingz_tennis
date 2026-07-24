import { requireAdminClub } from '@/lib/admin-context';
import { CourtTypesClient } from './court-types-client';

export default async function AdminCourtTypesPage() {
  await requireAdminClub();

  return <CourtTypesClient />;
}
