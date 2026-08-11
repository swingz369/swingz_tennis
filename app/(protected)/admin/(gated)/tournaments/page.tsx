import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { TournamentsClient } from './tournaments-client';
import type { PaginationMeta } from '@/lib/pagination';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:tournaments:page');

export const dynamic = 'force-dynamic';

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId } = await requireAdminClub();
  const resolvedParams = await searchParams;
  const { page, offset, limit } = getPagination(resolvedParams, 12);

  // Fetch tournaments with pagination
  let tournaments: Parameters<typeof TournamentsClient>[0]['initialTournaments'] = [];
  let pagination: PaginationMeta = buildPaginationMeta(page, limit, 0);
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
      log.error('[TournamentsPage] Query error:', tournamentsError);
    } else {
      tournaments = (tournamentsData || []) as unknown as typeof tournaments;
      pagination = buildPaginationMeta(page, limit, count);
    }
  } catch (err) {
    log.error('[TournamentsPage] Unexpected error:', err);
  }

  return <TournamentsClient initialTournaments={tournaments} pagination={pagination} />;
}
