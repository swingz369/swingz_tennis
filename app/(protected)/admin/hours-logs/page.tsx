import { requireAdminClub } from '@/lib/admin-context';
import HoursLogsClient from './hours-logs-client';

export const dynamic = 'force-dynamic';

export default async function HoursLogsPage() {
  await requireAdminClub();

  return <HoursLogsClient />;
}
