'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, UserCheck, Euro, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ClubData {
  id: string;
  name: string;
  members: number;
  trainers: number;
  revenue: number;
}

interface DashboardData {
  clubs: ClubData[];
  totalClubs: number;
  totalMembers: number;
  totalTrainers: number;
  totalRevenue: number;
}

export function SuperadminDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();

  const kpiCards = [
    {
      title: 'Vereine',
      value: data.totalClubs,
      icon: Building2,
      color: 'from-[#1B4332] to-[#2D6A4F]',
      href: '/admin/clubs',
    },
    {
      title: 'Mitglieder',
      value: data.totalMembers.toLocaleString(),
      icon: Users,
      color: 'from-[#3b82f6] to-[#1e3a5f]',
      href: '/admin/members',
    },
    {
      title: 'Trainer',
      value: data.totalTrainers,
      icon: UserCheck,
      color: 'from-[#22c55e] to-[#15803d]',
      href: '/admin/members',
    },
    {
      title: 'Umsatz',
      value: `€${data.totalRevenue.toLocaleString()}`,
      icon: Euro,
      color: 'from-[#FF6B35] to-[#ea580c]',
      href: '/admin/billing',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Plattform Dashboard</h1>
        <p className="text-gray-500">Übersicht aller Vereine</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.title}
            variant="elevated"
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(kpi.href)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${kpi.color} text-white`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Vereine</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.clubs.map((club) => (
              <div
                key={club.id}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] rounded-lg text-white">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{club.name}</p>
                    <p className="text-sm text-gray-500">
                      {club.members} Mitglieder · {club.trainers} Trainer
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/clubs`)}>
                  Details
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            ))}

            {data.clubs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Vereine vorhanden</p>
                <Button variant="link" onClick={() => router.push('/admin/clubs')}>
                  Ersten Verein anlegen
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
