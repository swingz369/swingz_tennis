import { requireAdminClub } from '@/lib/admin-context';
import { SettingsTabsWrapper } from './settings-tabs-wrapper';

export default async function SettingsPage() {
  const { clubId, isSuperadmin } = await requireAdminClub();

  return <SettingsTabsWrapper clubId={clubId} isSuperadmin={isSuperadmin} />;
}
