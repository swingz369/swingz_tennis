'use client';

import { ListState } from '@/components/ui/list-state';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Calendar, DollarSign, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/infrastructure/external/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { PageHeader } from '@/components/ui/page-header';

const log = createLogger('page:superadmin:tenants');

interface ClubStats {
  id: string;
  name: string;
  member_count: number;
  trainer_count: number;
  court_count: number;
  max_members: number;
  revenue: number;
  status: string;
}

export default function SuperadminTenantsPage() {
  const [clubs, setClubs] = useState<ClubStats[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchClubs = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clubs')
        .select(
          `
          id, name, status, max_members,
          user_club_memberships(count),
          trainer_club(count),
          courts(count)
        `
        )
        .eq('status', 'active')
        .order('name');

      if (error) {
        log.error('Failed to fetch clubs', error);
        toast.error('Fehler beim Laden der Vereine');
        return;
      }

      const clubsWithStats = data.map((club: any) => ({
        id: club.id,
        name: club.name,
        member_count: club.user_club_memberships?.[0]?.count || 0,
        trainer_count: club.trainer_club?.[0]?.count || 0,
        court_count: club.courts?.[0]?.count || 0,
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
            .select('amount')
            .eq('club_id', club.id)
            .eq('status', 'paid')
            .gte('paid_at', thirtyDaysAgo.toISOString());

          club.revenue =
            revenueData?.reduce(
              (sum: number, inv: { amount: number | null }) => sum + (Number(inv.amount) || 0),
              0
            ) || 0;
        })
      );

      setClubs(clubsWithStats);
    } catch (error) {
      log.error('Tenant fetch error', error);
      toast.error('Fehler beim Laden der Vereinsdaten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const switchToClub = (clubId: string, clubName: string) => {
    if (typeof document === 'undefined') return;

    // Set cookie for club context (24h expiry)
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    document.cookie = `admin_club_id=${clubId}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`; // eslint-disable-line react-hooks/immutability -- intentional side effect in click handler

    toast.success(`Gewechselt zu: ${clubName}`);
    router.push('/admin/members');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Übersicht"
        description="Wählen Sie einen Verein aus, um dessen Administration zu öffnen."
      />

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <ListState empty emptyTitle="Keine aktiven Vereine gefunden" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <Card key={club.id} className="hover:border-primary/50 hover:shadow-sm transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="truncate">{club.name}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {club.member_count}/{club.max_members} Mitglieder
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-muted-foreground dark:text-foreground">
                      <Users className="h-4 w-4" />
                      Mitglieder
                    </span>
                    <span className="font-bold text-lg">{club.member_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-muted-foreground dark:text-foreground">
                      <Calendar className="h-4 w-4" />
                      Trainer
                    </span>
                    <span className="font-bold text-lg">{club.trainer_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-muted-foreground dark:text-foreground">
                      <div className="h-4 w-4 rounded-full bg-info-500"></div>
                      Plätze
                    </span>
                    <span className="font-bold text-lg">{club.court_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-muted-foreground dark:text-foreground">
                      <DollarSign className="h-4 w-4" />
                      Umsatz (30 Tage)
                    </span>
                    <span className="font-bold text-lg">€{club.revenue.toFixed(0)}</span>
                  </div>
                  <Button
                    onClick={() => switchToClub(club.id, club.name)}
                    className="w-full mt-4 bg-primary hover:bg-brand-light/80"
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
