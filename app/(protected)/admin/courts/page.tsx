import AdminCourtCalendar from '@/components/admin-court-calendar';
import { requireAdminClub } from '@/lib/admin-context';

export default async function AdminCourtCalendarPage() {
  const { clubId } = await requireAdminClub();

  return <AdminCourtCalendar initialClubId={clubId} />;
}
