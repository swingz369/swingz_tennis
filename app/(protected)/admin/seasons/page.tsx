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
          'preferences_deadline, description, notes, created_at, club_id, ' +
          'total_preferences, submitted_preferences, planned_entries, ' +
          'open_conflicts, trainers_count, groups_covered'
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (seasonsError) {
      console.error('[SeasonsPage] Query error:', seasonsError);
    } else {
      seasons = (seasonsData || []).map((s: any) => ({
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
        total_preferences: Number(s.total_preferences || 0),
        submitted_preferences: Number(s.submitted_preferences || 0),
        planned_entries: Number(s.planned_entries || 0),
        open_conflicts: Number(s.open_conflicts || 0),
        trainers_count: Number(s.trainers_count || 0),
        groups_covered: Number(s.groups_covered || 0),
      })) as typeof seasons;
    }
  } catch (err) {
    console.error('[SeasonsPage] Unexpected error:', err);
  }

  return <SeasonsClient initialSeasons={seasons} />;
}
