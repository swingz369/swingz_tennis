import { requireAdminClub } from '@/lib/admin-context';
import AuditLogsTab from '../settings/audit-logs-tab';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const { clubId } = await requireAdminClub();

  return (
    <div className="container mx-auto p-6">
      <AuditLogsTab clubId={clubId} />
    </div>
  );
}
