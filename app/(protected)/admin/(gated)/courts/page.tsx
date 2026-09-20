import { requireAuth } from '@/lib/auth';
import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { createLogger } from '@/lib/logger';
import { CourtsHubTabs } from './courts-hub-tabs';
import type { Court } from '@/lib/types/court-booking';

const log = createLogger('admin:courts:page');

export default async function AdminCourtsPage() {
  await requireAuth();
  const { clubId } = await requireAdminClub();
  // requireAdminClub() hat Rolle + Vereinskontext bereits verifiziert. Der
  // Service-Client liest hier, damit RLS-Drift auf `courts`/`court_types`
  // (Scope über user_club_memberships) keine leere Platzliste erzeugt.
  const supabase = createServiceClient();

  const [
    { data: courts, error: courtsErr },
    { data: courtTypes, error: typesErr },
    { data: club, error: clubErr },
  ] = await Promise.all([
    supabase.from('courts').select('*').eq('club_id', clubId).order('number', { ascending: true }),
    // Platztypen sind optional: die Tabelle ist im Normalfall leer und
    // `courts.court_type_id` überall NULL — der Belag steht direkt in
    // `courts.surface`. Das Anlege-Formular fragt deshalb den Belag ab und
    // blendet die Typ-Auswahl nur ein, wenn der Verein welche angelegt hat.
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

  const features = (club?.features ?? {}) as Record<string, boolean>;
  // Wetter-Widget: direktes Flag statt Umweg über eine Sidebar-Sektions-
  // Logik — weather_integration hat keinen eigenen Sidebar-Link.
  const showWeather = features.weather_integration !== false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plätze"
        description="Kalender, Plätze, Wartung und Platzsperren an einem Ort"
      />
      <CourtsHubTabs
        clubId={clubId}
        initialCourts={(courts ?? []) as Court[]}
        courtTypes={(courtTypes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          surface: t.surface_type ?? '',
        }))}
        showWeather={showWeather}
      />
    </div>
  );
}
