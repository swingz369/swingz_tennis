import { requireAdminClub } from '@/lib/admin-context';
import EmailCampaignsClient from './email-campaigns-client';

export default async function EmailCampaignsPage() {
  const { clubId } = await requireAdminClub();
  return <EmailCampaignsClient clubId={clubId} />;
}
