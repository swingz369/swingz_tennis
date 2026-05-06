'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { createClient } from '@/infrastructure/external/supabase/client';
import { toast } from 'sonner';

interface ClubStats {
  id: string;
  name: string;
  member_count: number;
  trainer_count: number;
  active_sessions: number;
  max_members: number;
  revenue: number;
  status: string;
}

export default function SuperadminTenantsPage() {
  const [clubs, setClubs] = useState<ClubStats[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clubs')
        .select(
          `
          id, name, status, max_members,
          club_memberships(count),
          trainers(count),
          sessions(count)
        `
        )
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Failed to fetch clubs:', error);
        toast.error('Fehler beim Laden der Vereine');
        return;
      }

      const clubsWithStats = data.map((club: any) => ({
        id: club.id,
        name: club.name,
        member_count: club.club_memberships?.[0]?.count || 0,
        trainer_count: club.trainers?.[0]?.count || 0,
        active_sessions: club.sessions?.[0]?.count || 0,
        max_members: club.max_members,
        status: club.status,
        revenue: 0,
      }));

      // Fetch revenue for each club (parallel)
      await Promise.all(
        clubsWithStats.map(async (club: ClubStats) => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: revenueData } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('club_id', club.id)
            .eq('status', 'paid')
            .gte('paid_at', thirtyDaysAgo.toISOString());

          club.revenue =
            revenueData?.reduce(
              (sum: number, inv: { total_amount: number | null }) =>
                sum + (Number(inv.total_amount) || 0),
              0
            ) || 0;
        })
      );

      setClubs(clubsWithStats);
    } catch (error) {
      console.error('Tenant fetch error:', error);
      toast.error('Fehler beim Laden der Vereinsdaten');
    } finally {
      setLoading(false);
    }
  };

  const switchToClub = (clubId: string, clubName: string) => {
    if (typeof document === 'undefined') return;

    // Set cookie for club context (24h expiry)
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    document.cookie = `selected-club-id=${clubId}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;

    toast.success(`Gewechselt zu: ${clubName}`);
    router.push('/admin/members');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B4332]"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tenant Übersicht</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Wählen Sie einen Verein aus, um dessen Administration zu öffnen.
        </p>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Keine aktiven Vereine gefunden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <Card
              key={club.id}
              className="hover:shadow-xl transition-all duration-200 border-2 hover:border-[#1B4332]"
            >
              <CardHeader className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Building2 className="h-6 w-6" />
                  <span className="truncate">{club.name}</span>
                </CardTitle>
                <p className="text-sm text-white/80 mt-1">
                  {club.member_count}/{club.max_members} Mitglieder
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                      Mitglieder
                    </span>
                    <span className="font-bold text-lg">{club.member_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Calendar className="h-4 w-4" />
                      Trainer
                    </span>
                    <span className="font-bold text-lg">{club.trainer_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                      Sessions
                    </span>
                    <span className="font-bold text-lg">{club.active_sessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <DollarSign className="h-4 w-4" />
                      Umsatz (30 Tage)
                    </span>
                    <span className="font-bold text-lg">€{club.revenue.toFixed(0)}</span>
                  </div>
                  <Button
                    onClick={() => switchToClub(club.id, club.name)}
                    className="w-full mt-4 bg-[#1B4332] hover:bg-[#2D6A4F]"
                  >
                    Verein verwalten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
