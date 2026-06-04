import { requireAdminClub } from '@/lib/admin-context';
import SettingsClient from './settings-client';

export default async function SettingsPage() {
  await requireAdminClub();

  return <SettingsClient />;
}
