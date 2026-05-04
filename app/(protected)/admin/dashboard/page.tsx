import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { SuperadminDashboardClient } from './dashboard-client';

export default async function SuperadminDashboardPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  if (hasDemoMode) {
    const demoData = {
      clubs: [
        { id: '1', name: 'Demo Tennis Club', members: 120, trainers: 5, revenue: 12500 },
        { id: '2', name: 'Demo Squash Club', members: 80, trainers: 3, revenue: 8500 },
      ],
      totalClubs: 2,
      totalMembers: 200,
      totalTrainers: 8,
      totalRevenue: 21000,
    };
    return <SuperadminDashboardClient data={demoData} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
  if (!isSuperadmin) {
    redirect('/admin/analytics');
  }

  const { data: clubs } = await supabase.from('clubs').select('id, name');

  const clubsData = await Promise.all(
    (clubs || []).map(async (club: { id: string; name: string }) => {
      const { count: members } = await supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'member')
        .eq('is_active', true);

      const { count: trainers } = await supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('role', 'trainer')
        .eq('is_active', true);

      return {
        id: club.id,
        name: club.name,
        members: members || 0,
        trainers: trainers || 0,
        revenue: 0,
      };
    })
  );

  const data = {
    clubs: clubsData,
    totalClubs: clubsData.length,
    totalMembers: clubsData.reduce((sum, c) => sum + c.members, 0),
    totalTrainers: clubsData.reduce((sum, c) => sum + c.trainers, 0),
    totalRevenue: clubsData.reduce((sum, c) => sum + c.revenue, 0),
  };

  return <SuperadminDashboardClient data={data} />;
}
