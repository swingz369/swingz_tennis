import { requireAdminClub } from '@/lib/admin-context';
import SettingsClient from './settings-client';
import { SettingsTabsWrapper } from './settings-tabs-wrapper';

export default async function SettingsPage() {
  const { clubId } = await requireAdminClub();

  return (
    <SettingsTabsWrapper clubId={clubId}>
      <SettingsClient />
    </SettingsTabsWrapper>
  );
}
