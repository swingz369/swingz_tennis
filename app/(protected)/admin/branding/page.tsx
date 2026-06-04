import { requireAdminClub } from '@/lib/admin-context';
import BrandingSettingsClient from './branding-client';

export default async function BrandingSettingsPage() {
  const { clubId } = await requireAdminClub();

  return <BrandingSettingsClient clubId={clubId} />;
}
