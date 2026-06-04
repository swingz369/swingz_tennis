import { requireAdminClub } from '@/lib/admin-context';
import HoursLogsClient from './hours-logs-client';

export default async function HoursLogsPage() {
  await requireAdminClub();

  return <HoursLogsClient />;
}
