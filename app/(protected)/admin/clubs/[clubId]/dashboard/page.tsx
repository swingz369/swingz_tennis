import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { ClubDashboardClient } from './club-dashboard-client';

export const dynamic = 'force-dynamic';

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  desc: string;
}

export default async function ClubDashboardPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { clubId } = await params;

  // Zugriff: User muss Admin oder Superadmin dieses Vereins sein
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const hasAccess = memberships?.some(
    (m) => (m.role === 'superadmin' || m.role === 'admin') && m.club_id === clubId
  );

  if (!hasAccess) {
    redirect('/admin/members');
  }

  // Club-Daten
  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).single();

  if (!club) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">Verein nicht gefunden</p>
        </div>
      </div>
    );
  }

  // Statistiken
  const [{ count: membersCount }, { count: trainersCount }, { count: courtsCount }] =
    await Promise.all([
      supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('role', 'member')
        .eq('is_active', true),
      supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true),
      supabase.from('courts').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
    ]);

  const menuItems: MenuItem[] = [
    {
      label: 'Mitglieder',
      href: `/admin/members?clubId=${clubId}`,
      icon: 'members',
      desc: 'Mitglieder verwalten',
    },
    {
      label: 'Trainer',
      href: `/admin/trainers?clubId=${clubId}`,
      icon: 'trainers',
      desc: 'Trainer verwalten',
    },
    {
      label: 'Plätze',
      href: `/admin/courts?clubId=${clubId}`,
      icon: 'courts',
      desc: 'Plätze verwalten',
    },
    {
      label: 'Stundenplan',
      href: `/admin/schedules?clubId=${clubId}`,
      icon: 'schedule',
      desc: 'Stundenplan erstellen',
    },
    {
      label: 'Statistiken',
      href: `/admin/analytics?clubId=${clubId}`,
      icon: 'analytics',
      desc: 'Auswertungen',
    },
  ];

  const stats = {
    members: membersCount ?? 0,
    trainers: trainersCount ?? 0,
    courts: courtsCount ?? 0,
  };

  return (
    <ClubDashboardClient clubName={club.name} stats={stats} menuItems={menuItems} clubId={clubId} />
  );
}
