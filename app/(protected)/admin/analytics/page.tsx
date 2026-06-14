import { requireAdminClub } from '@/lib/admin-context';
import { AnalyticsClient } from './analytics-client';
import { AnalyticsTabsClient } from './analytics-tabs-client';
import { ClubSelector } from './club-selector';
import type { AnalyticsData } from './analytics-client';

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
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analytics</h1>
        <p className="text-red-500">Keine Club-Daten gefunden.</p>
      </div>
    );
  }

  // Fetch club names
  const { data: clubsData } = await supabase.from('clubs').select('id, name').in('id', clubIds);

  const clubs = (clubsData ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  if (clubs.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analytics</h1>
        <p className="text-red-500">Keine Club-Daten gefunden.</p>
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
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', effectiveClubId)
          .eq('role', 'trainer')
          .eq('is_active', true),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', effectiveClubId),
        supabase
          .from('sessions')
          .select('id, timeslot_start, trainer_id, schedules!inner(club_id)')
          .eq('schedules.club_id', effectiveClubId)
          .order('timeslot_start', { ascending: false })
          .limit(200),
      ]);

    // Bookings over last 6 months grouped by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('id, created_at')
      .eq('club_id', effectiveClubId)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    // Group bookings by week
    const bookingsByWeek = new Map<string, number>();
    (recentBookings ?? []).forEach((b: any) => {
      const weekKey = b.created_at?.substring(0, 10) ?? '';
      bookingsByWeek.set(weekKey, (bookingsByWeek.get(weekKey) ?? 0) + 1);
    });

    const bookingsOverTime = Array.from(bookingsByWeek.entries())
      .map(([date, bookings]) => ({ date, bookings }))
      .slice(0, 30);

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
      const { data: trainerUsers } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', trainerIds);
      (trainerUsers ?? []).forEach((u: any) => {
        trainerNamesMap.set(u.id, u.full_name || 'Trainer');
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

    analyticsData = {
      totalMembers: totalMembers ?? 0,
      totalBookings: totalBookings ?? 0,
      totalRevenue: 0,
      totalSessions: totalSessionCount,
      revenueByClub: [
        { club: clubs.find((c) => c.id === effectiveClubId)?.name ?? '', revenue: 0 },
      ],
      bookingsOverTime,
      sessionsPerTrainer,
      capacityUtilization,
    };
  } catch (error) {
    console.error('Error loading analytics:', error);
    fetchError = true;
  }

  if (fetchError || !analyticsData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analytics</h1>
        <p className="text-red-500">
          Fehler beim Laden der Vereinsstatistiken. Bitte versuchen Sie es später erneut.
        </p>
      </div>
    );
  }

  return (
    <AnalyticsTabsClient>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Vereinsanalyse</h1>
            <p className="text-muted-foreground">
              {clubs.find((c) => c.id === effectiveClubId)?.name}
            </p>
          </div>
          {clubs.length > 1 && <ClubSelector clubs={clubs} selectedClubId={effectiveClubId} />}
        </div>

        <AnalyticsClient data={analyticsData} />
      </div>
    </AnalyticsTabsClient>
  );
}
