import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import type { TournamentsClient } from '../tournaments/tournaments-client';
import type { PaginationMeta } from '@/lib/pagination';
import { createLogger } from '@/lib/logger';
import { EventsHubTabs } from './events-hub-tabs';

const log = createLogger('admin:events:page');

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Veranstaltungen | SwingZ' };

type TournamentsClientProps = Parameters<typeof TournamentsClient>[0];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId } = await requireAdminClub();
  const resolvedParams = await searchParams;
  const { page, offset, limit } = getPagination(resolvedParams, 12);

  // Turniere sind ein optionales Modul — der Tab erscheint nur, wenn das
  // Feature-Flag gesetzt ist. Sonderveranstaltungen sind immer verfügbar.
  let showTournaments = false;
  try {
    const { data: club } = await supabase
      .from('clubs')
      .select('features')
      .eq('id', clubId)
      .maybeSingle();
    showTournaments = ((club?.features ?? {}) as Record<string, boolean>).tournaments === true;
  } catch (err) {
    log.error('[EventsPage] Failed to load club features', err);
  }

  let tournaments: TournamentsClientProps['initialTournaments'] = [];
  let pagination: PaginationMeta = buildPaginationMeta(page, limit, 0);
  if (showTournaments) {
    try {
      const {
        data: tournamentsData,
        error: tournamentsError,
        count,
      } = await supabase
        .from('tournaments')
        .select(
          'id, name, description, format, category, start_date, end_date, status, ' +
            'max_participants, registration_deadline, entry_fee',
          { count: 'exact' }
        )
        .eq('club_id', clubId)
        .order('start_date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (tournamentsError) {
        log.error('[EventsPage] Query error:', tournamentsError);
      } else {
        tournaments = (tournamentsData || []) as unknown as typeof tournaments;
        pagination = buildPaginationMeta(page, limit, count);
      }
    } catch (err) {
      log.error('[EventsPage] Unexpected error:', err);
    }
  }

  return (
    <EventsHubTabs
      showTournaments={showTournaments}
      initialTournaments={tournaments}
      pagination={pagination}
    />
  );
}
