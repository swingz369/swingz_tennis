import { requireAdminClub } from '@/lib/admin-context';
import { PageHeader } from '@/components/ui/page-header';
import { AnalyticsClient } from './analytics-client';
import { AnalyticsTabsClient } from './analytics-tabs-client';
import { ClubSelector } from './club-selector';
import type { AnalyticsData } from './analytics-client';

import { format, getISOWeek, parseISO, startOfISOWeek } from 'date-fns';
import { createLogger } from '@/lib/logger';
import { fetchAll } from '@/infrastructure/persistence/repositories/paged';

const log = createLogger('admin:analytics:page');

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { supabase, isSuperadmin, clubId: defaultClubId } = await requireAdminClub();

  // Build clubs list — superadmins can see all clubs
  let clubIds: string[] = [];

  if (isSuperadmin) {
    const { data: allClubs } = await supabase.from('clubs').select('id').limit(100);
    clubIds = (allClubs ?? []).map((c: any) => c.id);
  } else {
    clubIds = [defaultClubId];
  }

  if (clubIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vereinsanalyse" />
        <p className="text-error-500">Keine Club-Daten gefunden.</p>
      </div>
    );
  }

  // Fetch club names
  const { data: clubsData } = await supabase.from('clubs').select('id, name').in('id', clubIds);

  const clubs = (clubsData ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  if (clubs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vereinsanalyse" />
        <p className="text-error-500">Keine Club-Daten gefunden.</p>
      </div>
    );
  }

  // Determine which club to display
  const params = await searchParams;
  const clubIdFromParams = params.clubId;
  let effectiveClubId = clubs[0].id;
  if (clubIdFromParams && clubs.some((c) => c.id === clubIdFromParams)) {
    effectiveClubId = clubIdFromParams;
  }

  let analyticsData: AnalyticsData | null = null;
  let fetchError = false;

  try {
    // Fetch analytics data directly via Supabase
    const [{ count: totalMembers }, { count: totalBookings }, { data: sessionsData }] =
      await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', effectiveClubId)
          .eq('is_active', true)
          .not('role', 'in', '(trainer,superadmin)'),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', effectiveClubId),
        supabase
          .from('sessions')
          .select('id, timeslot_start, trainer_id, court_id, schedules!inner(club_id)')
          .eq('schedules.club_id', effectiveClubId)
          .order('timeslot_start', { ascending: false })
          .limit(200),
      ]);

    // Buchungen der letzten 6 Monate je Kalenderwoche. bookings hat kein created_at —
    // die Abfrage scheiterte daran still und das Diagramm blieb leer.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentBookings = await fetchAll<{ booked_at: string | null }>(
      () =>
        supabase
          .from('bookings')
          .select('booked_at')
          .eq('club_id', effectiveClubId)
          .gte('booked_at', sixMonthsAgo.toISOString())
          .order('booked_at', { ascending: true })
          .order('id'),
      'Buchungen für Vereinsanalyse laden'
    );

    const bookingsByWeek = new Map<string, number>();
    for (const b of recentBookings) {
      if (!b.booked_at) continue;
      const weekKey = format(startOfISOWeek(parseISO(b.booked_at)), 'yyyy-MM-dd');
      bookingsByWeek.set(weekKey, (bookingsByWeek.get(weekKey) ?? 0) + 1);
    }

    // Aufsteigend sortiert, Beschriftung = Montag der Woche („KW 38 · 14.09.")
    const bookingsOverTime = Array.from(bookingsByWeek.entries()).map(([monday, bookings]) => {
      const d = parseISO(monday);
      return { date: `KW ${getISOWeek(d)} · ${format(d, 'dd.MM.')}`, bookings };
    });

    // Sessions per trainer
    const trainerSessionCounts = new Map<string, number>();
    (sessionsData ?? []).forEach((s: any) => {
      if (s.trainer_id) {
        trainerSessionCounts.set(s.trainer_id, (trainerSessionCounts.get(s.trainer_id) ?? 0) + 1);
      }
    });

    // Fetch trainer names
    const trainerIds = Array.from(trainerSessionCounts.keys());
    const trainerNamesMap = new Map<string, string>();
    if (trainerIds.length > 0) {
      // sessions.trainer_id zeigt auf trainers.id, nicht auf users.id — die frühere
      // users-Abfrage fand nie etwas, jeder Balken hieß „Trainer".
      const { data: trainers } = await supabase
        .from('trainers')
        .select('id, name')
        .in('id', trainerIds);
      (trainers ?? []).forEach((t) => {
        trainerNamesMap.set(t.id, t.name || 'Trainer');
      });
    }

    const sessionsPerTrainer = Array.from(trainerSessionCounts.entries()).map(
      ([trainerId, sessions]) => ({
        trainer: trainerNamesMap.get(trainerId) ?? 'Trainer',
        sessions,
      })
    );

    // Courts capacity utilization
    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .eq('club_id', effectiveClubId)
      .eq('is_active', true);

    const courtSessionCounts = new Map<string, number>();
    (sessionsData ?? []).forEach((s: Record<string, unknown> & { court_id?: string }) => {
      if (s.court_id) {
        courtSessionCounts.set(s.court_id, (courtSessionCounts.get(s.court_id) ?? 0) + 1);
      }
    });

    const totalSessionCount = sessionsData?.length ?? 0;
    const capacityUtilization = (courts ?? []).map((c: any) => ({
      court: c.name,
      util:
        totalSessionCount > 0
          ? Math.round(((courtSessionCounts.get(c.id) ?? 0) / totalSessionCount) * 100)
          : 0,
    }));

    // Fetch revenue from paid invoices for the selected club
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('amount')
      .eq('club_id', effectiveClubId)
      .eq('status', 'paid');

    const totalRevenue = (paidInvoices ?? []).reduce(
      (sum: number, inv: { amount: number | null }) => sum + (Number(inv.amount) || 0),
      0
    );

    analyticsData = {
      totalMembers: totalMembers ?? 0,
      totalBookings: totalBookings ?? 0,
      totalRevenue,
      totalSessions: totalSessionCount,
      revenueByClub: [
        { club: clubs.find((c) => c.id === effectiveClubId)?.name ?? '', revenue: totalRevenue },
      ],
      bookingsOverTime,
      sessionsPerTrainer,
      capacityUtilization,
    };
  } catch (error) {
    log.error('Error loading analytics:', error);
    fetchError = true;
  }

  if (fetchError || !analyticsData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vereinsanalyse" />
        <p className="text-error-500">
          Fehler beim Laden der Vereinsstatistiken. Bitte versuchen Sie es später erneut.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Vereinsanalyse"
          description={clubs.find((c) => c.id === effectiveClubId)?.name}
        />
        {clubs.length > 1 && <ClubSelector clubs={clubs} selectedClubId={effectiveClubId} />}
      </div>

      <AnalyticsTabsClient>
        <AnalyticsClient data={analyticsData} />
      </AnalyticsTabsClient>
    </div>
  );
}
