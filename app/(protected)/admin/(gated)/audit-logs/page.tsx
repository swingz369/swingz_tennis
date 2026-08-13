import { requireAdminClub } from '@/lib/admin-context';
import AuditLogsTab from '../settings/audit-logs-tab';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const { clubId } = await requireAdminClub();

  return (
    <div className="space-y-6">
      <PageHeader title="Audit-Logs" />
      <AuditLogsTab clubId={clubId} />
    </div>
  );
}
