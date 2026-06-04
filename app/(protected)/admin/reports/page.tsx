import { requireAdminClub } from '@/lib/admin-context';
import ReportsDashboard from '@/components/reports-dashboard';

export default async function ReportsPage() {
  await requireAdminClub();

  return <ReportsDashboard />;
}
