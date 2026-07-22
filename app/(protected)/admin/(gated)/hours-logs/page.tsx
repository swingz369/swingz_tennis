import { requireAdminClub } from '@/lib/admin-context';
import HoursLogsClient from './hours-logs-client';
import { HoursLogsTabsWrapper } from './hours-logs-tabs-wrapper';

export const dynamic = 'force-dynamic';

export default async function HoursLogsPage() {
  const { user } = await requireAdminClub();

  return (
    <HoursLogsTabsWrapper adminUserId={user.id}>
      <HoursLogsClient />
    </HoursLogsTabsWrapper>
  );
}
