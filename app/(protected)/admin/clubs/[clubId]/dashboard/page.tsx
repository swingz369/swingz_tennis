import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Building2, Users, UserCheck, Calendar, DollarSign, BarChart3 } from 'lucide-react';

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
    (m: { role: string; club_id: string }) =>
      (m.role === 'superadmin' || m.role === 'admin') && m.club_id === clubId
  );

  if (!hasAccess) {
    redirect('/admin/members');
  }

  // Club-Daten
  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).single();

  if (!club) {
    return <div className="p-6">Verein nicht gefunden</div>;
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

  const menuItems = [
    {
      label: 'Mitglieder',
      href: `/admin/members?clubId=${clubId}`,
      icon: Users,
      desc: 'Mitglieder verwalten',
    },
    {
      label: 'Trainer',
      href: `/admin/trainers?clubId=${clubId}`,
      icon: UserCheck,
      desc: 'Trainer verwalten',
    },
    {
      label: 'Plätze',
      href: `/admin/courts?clubId=${clubId}`,
      icon: Building2,
      desc: 'Plätze verwalten',
    },
    {
      label: 'Stundenplan',
      href: `/admin/schedules?clubId=${clubId}`,
      icon: Calendar,
      desc: 'Stundenplan erstellen',
    },
    {
      label: 'Statistiken',
      href: `/admin/analytics?clubId=${clubId}`,
      icon: BarChart3,
      desc: 'Auswertungen',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">{club.name}</h1>
        <p className="text-gray-500">Vereins-Administration</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mitglieder</p>
              <p className="text-3xl font-bold">{membersCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-6 border rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Trainer</p>
              <p className="text-3xl font-bold">{trainersCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-6 border rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Plätze</p>
              <p className="text-3xl font-bold">{courtsCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col p-6 border rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-gray-900"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{item.label}</h3>
            </div>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
