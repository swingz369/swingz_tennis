import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { SeasonsClient } from './seasons-client';
import type { PaginationMeta } from '@/lib/pagination';
import { detectConflictsForSeason } from '@/lib/season-planning/conflict-detector';

export const dynamic = 'force-dynamic';

export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId } = await requireAdminClub();
  const resolvedParams = await searchParams;
  const { page, offset, limit } = getPagination(resolvedParams, 12);

  // Fetch ALL season IDs for club-wide stats (unpaginated)
  // Then fetch paginated seasons for display
  let seasons: Parameters<typeof SeasonsClient>[0]['initialSeasons'] = [];
  let pagination: PaginationMeta = buildPaginationMeta(page, limit, 0);
  try {
    // 1) Lightweight query: all season IDs for this club (for stats)
    const { data: allSeasonRows } = await supabase
      .from('seasons')
      .select('id')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    const allSeasonIds = (allSeasonRows || []).map((s: any) => s.id as string);

    // 2) Paginated query for display
    const {
      data: seasonsData,
      error: seasonsError,
      count,
    } = await supabase
      .from('seasons')
      .select(
        'id, name, season_type, year, start_date, end_date, planning_status, is_active, ' +
          'preferences_deadline, description, notes, created_at, club_id',
        { count: 'exact' }
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (seasonsError) {
      console.error('[SeasonsPage] Query error:', seasonsError);
    }

    pagination = buildPaginationMeta(page, limit, count);

    // Fetch real stats from related tables (scoped to ALL seasons for club-wide KPIs)
    let prefsData: any[] = [];
    let entriesData: any[] = [];
    let groupsData: any[] = [];
    let trainerCount = 0;

    // Count trainers for this club
    const { count: trainersInClub } = await supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true);
    trainerCount = trainersInClub ?? 0;

    // Erwartete Präferenzen = planungsrelevante Mitglieder des Vereins (wie Detail-API)
    const { count: planningMembers } = await supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true)
      .eq('include_in_planning', true);

    if (allSeasonIds.length > 0) {
      const [prefsRes, entriesRes, groupsRes] = await Promise.all([
        supabase
          .from('user_training_preferences')
          .select('season_id, is_submitted, user_role')
          .in('season_id', allSeasonIds),
        supabase
          .from('season_plan_entries')
          .select('season_id, group_id')
          .in('season_id', allSeasonIds),
        supabase
          .from('season_plan_entries')
          .select('season_id, group_id')
          .in('season_id', allSeasonIds)
          .not('group_id', 'is', null),
      ]);

      prefsData = prefsRes.data || [];
      entriesData = entriesRes.data || [];
      groupsData = groupsRes.data || [];
    }

    // Live conflict count — scoped to the paginated (displayed) seasons only,
    // not all-time, to bound the extra reads. Replaces the stale
    // planning_conflicts table, which is only populated once at Publish-time.
    const displayedSeasonIds = (seasonsData || []).map((s: any) => s.id as string);
    const conflictsBySeasonLive = new Map<string, number>();
    if (displayedSeasonIds.length > 0) {
      const results = await Promise.all(
        displayedSeasonIds.map((sid) =>
          detectConflictsForSeason(sid, clubId).then((r) => [sid, r.summary.total] as const)
        )
      );
      for (const [sid, total] of results) conflictsBySeasonLive.set(sid, total);
    }

    // Compute per-season statistics (eingereichte Mitglieder-Präferenzen)
    const prefsBySeason = new Map<string, { submitted: number }>();
    for (const p of prefsData) {
      const sid = p.season_id as string;
      const cur = prefsBySeason.get(sid) || { submitted: 0 };
      if (p.is_submitted && p.user_role === 'member') cur.submitted++;
      prefsBySeason.set(sid, cur);
    }

    const entriesBySeason = new Map<string, number>();
    for (const e of entriesData) {
      const sid = e.season_id as string;
      entriesBySeason.set(sid, (entriesBySeason.get(sid) || 0) + 1);
    }

    const groupsBySeason = new Map<string, Set<string>>();
    for (const g of groupsData) {
      const sid = g.season_id as string;
      if (!groupsBySeason.has(sid)) groupsBySeason.set(sid, new Set());
      groupsBySeason.get(sid)!.add(g.group_id as string);
    }

    seasons = (seasonsData || []).map((s: any) => {
      const prefs = prefsBySeason.get(s.id);
      return {
        id: s.id,
        name: s.name,
        season_type: s.season_type,
        year: s.year,
        start_date: s.start_date,
        end_date: s.end_date,
        planning_status: s.planning_status,
        is_active: s.is_active,
        preferences_deadline: s.preferences_deadline,
        description: s.description,
        notes: s.notes,
        created_at: s.created_at,
        club_id: s.club_id,
        total_preferences: planningMembers ?? 0,
        submitted_preferences: prefs?.submitted ?? 0,
        planned_entries: entriesBySeason.get(s.id) ?? 0,
        open_conflicts: conflictsBySeasonLive.get(s.id) ?? 0,
        trainers_count: trainerCount,
        groups_covered: groupsBySeason.get(s.id)?.size ?? 0,
      };
    }) as typeof seasons;
  } catch (err) {
    console.error('[SeasonsPage] Unexpected error:', err);
  }

  return <SeasonsClient initialSeasons={seasons} pagination={pagination} />;
}
