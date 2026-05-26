import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { SeasonsClient } from './seasons-client';

export const dynamic = 'force-dynamic';

export default async function SeasonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get club memberships
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!memberships || memberships.length === 0) {
    redirect('/dashboard');
  }

  // Determine effective clubId
  const isSuperadmin = memberships.some((m: { role: string }) => m.role === 'superadmin');
  let clubId: string;
  if (isSuperadmin) {
    const cookieStore = await cookies();
    clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value || memberships[0].club_id!;
    if (!clubId) redirect('/select-admin-club');
  } else {
    const adminMembership = memberships.find((m: any) => m.role === 'admin');
    clubId = adminMembership?.club_id ?? '';
    if (!clubId) redirect('/member');
  }

  // Fetch seasons with explicit field selection
  let seasons: Parameters<typeof SeasonsClient>[0]['initialSeasons'] = [];
  try {
    const { data: seasonsData, error: seasonsError } = await supabase
      .from('seasons')
      .select(
        'id, name, season_type, year, start_date, end_date, planning_status, is_active, ' +
          'preferences_deadline, description, notes, created_at, club_id'
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (seasonsError) {
      console.error('[SeasonsPage] Query error:', seasonsError);
    }

    const seasonIds = (seasonsData || []).map((s: any) => s.id);

    // Fetch real stats from related tables
    let prefsData: any[] = [];
    let entriesData: any[] = [];
    let conflictsData: any[] = [];
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

    if (seasonIds.length > 0) {
      const [prefsRes, entriesRes, conflictsRes, groupsRes] = await Promise.all([
        supabase
          .from('user_training_preferences')
          .select('season_id, is_submitted')
          .in('season_id', seasonIds),
        supabase
          .from('season_plan_entries')
          .select('season_id, group_id')
          .in('season_id', seasonIds),
        supabase
          .from('planning_conflicts')
          .select('season_id, status')
          .in('season_id', seasonIds)
          .eq('status', 'open'),
        supabase
          .from('season_plan_entries')
          .select('season_id, group_id')
          .in('season_id', seasonIds)
          .not('group_id', 'is', null),
      ]);

      prefsData = prefsRes.data || [];
      entriesData = entriesRes.data || [];
      conflictsData = conflictsRes.data || [];
      groupsData = groupsRes.data || [];
    }

    // Compute per-season statistics
    const prefsBySeason = new Map<string, { total: number; submitted: number }>();
    for (const p of prefsData) {
      const sid = p.season_id as string;
      const cur = prefsBySeason.get(sid) || { total: 0, submitted: 0 };
      cur.total++;
      if (p.is_submitted) cur.submitted++;
      prefsBySeason.set(sid, cur);
    }

    const entriesBySeason = new Map<string, number>();
    for (const e of entriesData) {
      const sid = e.season_id as string;
      entriesBySeason.set(sid, (entriesBySeason.get(sid) || 0) + 1);
    }

    const conflictsBySeason = new Map<string, number>();
    for (const c of conflictsData) {
      const sid = c.season_id as string;
      conflictsBySeason.set(sid, (conflictsBySeason.get(sid) || 0) + 1);
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
        total_preferences: prefs?.total ?? 0,
        submitted_preferences: prefs?.submitted ?? 0,
        planned_entries: entriesBySeason.get(s.id) ?? 0,
        open_conflicts: conflictsBySeason.get(s.id) ?? 0,
        trainers_count: trainerCount,
        groups_covered: groupsBySeason.get(s.id)?.size ?? 0,
      };
    }) as typeof seasons;
  } catch (err) {
    console.error('[SeasonsPage] Unexpected error:', err);
  }

  return <SeasonsClient initialSeasons={seasons} />;
}
