'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton as KPISkeleton } from '@/components/ui';
import { Users, Calendar, ClipboardList, Building2, Trophy, ArrowRight } from 'lucide-react';
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis';
import { createClient } from '@/infrastructure/external/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

interface DashboardClientProps {
  user: {
    id: string;
    email: string;
    user_metadata: { full_name?: string };
  };
  clubs: Array<{ id: string; name: string; max_members?: number; status?: string }>;
}

export function DashboardClient({ user, clubs }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.id || '');

  const {
    data: kpis = { activeMembers: 0, sessionsToday: 0, pendingBookings: 0, totalCourts: 0 },
    isLoading,
  } = useDashboardKpis();

  console.log('🔍 DashboardClient: Received clubs prop:', clubs);
  console.log('🔍 DashboardClient: Selected clubId:', selectedClubId);

  useEffect(() => {
    const supabaseClient = createClient();
    setSupabase(supabaseClient);
  }, []);

  useEffect(() => {
    const clubFromUrl = searchParams.get('clubId');
    if (clubFromUrl && clubs.some((c) => c.id === clubFromUrl)) {
      setSelectedClubId(clubFromUrl);
    } else if (clubs.length > 0) {
      setSelectedClubId(clubs[0].id);
    }
  }, [searchParams, clubs]);

  const handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore errors
    }
    document.cookie = 'demo-mode=; path=/; max-age=0';
    router.refresh();
  };

  const handleClubChange = (newClubId: string) => {
    setSelectedClubId(newClubId);
    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('clubId', newClubId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const kpiCards = [
    {
      title: 'Aktive Mitglieder',
      value: kpis.activeMembers,
      description: 'Aktive Vereinsmitglieder',
      icon: Users,
      color: 'text-brand-primary' as const,
    },
    {
      title: 'Sessions heute',
      value: kpis.sessionsToday,
      description: 'Trainings heute',
      icon: Calendar,
      color: 'text-brand-accent-600' as const,
    },
    {
      title: 'Offene Buchungen',
      value: kpis.pendingBookings,
      description: 'Bestätigung ausstehend',
      icon: ClipboardList,
      color: 'text-yellow-600' as const,
    },
    {
      title: 'Courts',
      value: kpis.totalCourts,
      description: 'Verfügbare Plätze',
      icon: Building2,
      color: 'text-blue-600' as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">SWINGZ Dashboard</h1>
          <p className="text-gray-500">
            Willkommen zurück, {user.user_metadata?.full_name || user.email?.split('@')[0]}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {clubs.length > 1 && (
            <select
              value={selectedClubId}
              onChange={(e) => handleClubChange(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={handleSignOut} variant="outline">
            Abmelden
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
          </>
        ) : (
          kpiCards.map((kpi) => (
            <Card key={kpi.title} variant="elevated" className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{kpi.description}</p>
                </div>
                <div className={`p-3 rounded-full bg-gray-50 ${kpi.color}`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-brand-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            variant="bordered"
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push('/scheduler')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Trainingsplanung</p>
                <p className="text-xs text-gray-500">KI-optimierter Stundenplan</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          </Card>

          <Card
            variant="bordered"
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push('/bookings')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Buchungen</p>
                <p className="text-xs text-gray-500">Court- und Spielerbuchungen</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          </Card>

          <Card
            variant="bordered"
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push('/admin/analytics')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Analytics</p>
                <p className="text-xs text-gray-500">Vereinsstatistiken</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          </Card>
        </div>
      </div>

      {/* Clubs Section */}
      {clubs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-brand-primary mb-4">Deine Vereine</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => (
              <Card
                key={club.id}
                variant={club.id === selectedClubId ? 'elevated' : 'bordered'}
                className="p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{club.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      club.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {club.status || 'aktiv'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Max. Mitglieder: {club.max_members || 'N/A'}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
