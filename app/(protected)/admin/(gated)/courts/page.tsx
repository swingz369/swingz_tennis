import { requireAuth } from '@/lib/auth';
import { requireAdminClub } from '@/lib/admin-context';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { getHiddenSidebarSections } from '@/lib/features';
import { createLogger } from '@/lib/logger';
import { CourtsHubTabs } from './courts-hub-tabs';
import type { HardwareVendor } from '@/lib/hardware/adapter';
import type { Court } from '@/lib/types/court-booking';

const log = createLogger('admin:courts:page');

export default async function AdminCourtsPage() {
  await requireAuth();
  const { clubId } = await requireAdminClub();
  const supabase = await createClient();

  const [
    { data: courts, error: courtsErr },
    { data: courtTypes, error: typesErr },
    { data: club, error: clubErr },
  ] = await Promise.all([
    supabase.from('courts').select('*').eq('club_id', clubId).order('number', { ascending: true }),
    supabase
      .from('court_types')
      .select('id, name, surface_type')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase.from('clubs').select('features').eq('id', clubId).maybeSingle(),
  ]);

  if (courtsErr) log.error('Failed to load courts', { club_id: clubId, error: courtsErr.message });
  if (typesErr)
    log.error('Failed to load court types', { club_id: clubId, error: typesErr.message });
  if (clubErr)
    log.error('Failed to load club features', { club_id: clubId, error: clubErr.message });

  const features = (club?.features ?? {}) as Record<string, unknown>;
  const hidden = getHiddenSidebarSections(features as Record<string, boolean>);

  const vendorRaw = features.hardware_vendor;
  const initialVendor: HardwareVendor =
    vendorRaw === 'nuki' || vendorRaw === 'shelly' || vendorRaw === 'loxone' ? vendorRaw : 'shelly';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platzverwaltung"
        description="Plätze, Wartung, Platzsperren und Smart-Court an einem Ort"
      />
      <CourtsHubTabs
        clubId={clubId}
        initialCourts={(courts ?? []) as Court[]}
        courtTypes={(courtTypes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          surface: t.surface_type ?? '',
        }))}
        showWeather={!hidden.has('weather_integration')}
        showSmartCourt={!hidden.has('smart_court')}
        initialVendor={initialVendor}
      />
    </div>
  );
}
