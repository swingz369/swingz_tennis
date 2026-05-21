import { createClient } from '@/infrastructure/external/supabase/server';
import { AdminPanelV2Client } from './admin-panel-v2-client';

export const dynamic = 'force-dynamic';

export interface ClubWithStats {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  trainerCount: number;
}

export interface PlatformStats {
  totalClubs: number;
  totalMembers: number;
  totalTrainers: number;
}

/**
 * Superadmin Dashboard Page — Platform-wide overview
 * Shows ALL clubs accessible to the superadmin, not just one.
 * RBAC enforced by layout.tsx (redirects non-superadmins away).
 */
export default async function SuperadminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // layout.tsx handles redirect

  // Load ALL clubs (superadmin sees all clubs, not just memberships)
  // First get the user's superadmin memberships to know which clubs they can manage
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, clubs(id, name, status)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = (memberships ?? []).some((m: any) => m.role === 'superadmin');

  // Collect all unique clubs from memberships
  const clubsFromMemberships: ClubWithStats[] = (memberships ?? [])
    .map((m: any) => {
      const clubRaw = m.clubs;
      const club = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
      if (!club) return null;
      return {
        id: club.id as string,
        name: club.name as string,
        status: (club.status as string) || 'active',
        memberCount: 0,
        trainerCount: 0,
      };
    })
    .filter(Boolean)
    .filter((c, i, self) => i === self.findIndex((x) => x?.id === c?.id)) as ClubWithStats[];

  // If superadmin, also fetch ALL clubs from the clubs table (they can manage any)
  let allClubs: ClubWithStats[];
  if (isSuperadmin) {
    const { data: clubsData } = await supabase
      .from('clubs')
      .select('id, name, status')
      .order('name');
    allClubs = (clubsData ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status || 'active',
      memberCount: 0,
      trainerCount: 0,
    }));
  } else {
    allClubs = clubsFromMemberships;
  }

  // Get member/trainer counts per club (in parallel)
  const clubsWithStats = await Promise.all(
    allClubs.map(async (club) => {
      const [{ count: members }, { count: trainers }] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true)
          .neq('role', 'trainer'),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'trainer')
          .eq('is_active', true),
      ]);
      return { ...club, memberCount: members ?? 0, trainerCount: trainers ?? 0 };
    })
  );

  // Platform aggregate stats
  const platformStats: PlatformStats = {
    totalClubs: clubsWithStats.length,
    totalMembers: clubsWithStats.reduce((sum, c) => sum + c.memberCount, 0),
    totalTrainers: clubsWithStats.reduce((sum, c) => sum + c.trainerCount, 0),
  };

  // Get user profile for greeting
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName =
    profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Superadmin';

  return (
    <AdminPanelV2Client
      clubs={clubsWithStats}
      platformStats={platformStats}
      userRole="superadmin"
      firstName={firstName}
    />
  );
}
