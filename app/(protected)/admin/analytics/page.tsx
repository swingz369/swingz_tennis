import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AnalyticsClient } from './analytics-client';
import { ClubSelector } from './club-selector';
import type { AnalyticsData } from './analytics-client';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get all active club memberships with club details
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // Check if user has admin or superadmin role
  const isSuperadmin = memberships?.some((m: any) => m.role === 'superadmin');
  const isAdmin = memberships?.some((m: any) => m.role === 'admin');

  if (!isSuperadmin && !isAdmin) {
    // User has neither admin nor superadmin role
    redirect('/bookings');
  }

  // Now fetch full membership data with club details for the selected club
  // For regular admins, only show clubs they're admin of
  // For superadmins, show all clubs they have access to
  let clubQuery = supabase
    .from('user_club_memberships')
    .select('club_id, role, clubs!inner(name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // If not superadmin, filter to only show clubs where user is admin
  if (!isSuperadmin) {
    clubQuery = clubQuery.eq('role', 'admin');
  }

  const { data: membershipsWithClubs } = await clubQuery;

  type Membership = {
    club_id: string;
    clubs: { id: string; name: string }[];
  };

  if (!membershipsWithClubs || membershipsWithClubs.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analytics</h1>
        <p className="text-gray-500">Sie sind keinem Verein zugeordnet.</p>
      </div>
    );
  }

  // Build clubs list (clubs is an array from the join)
  const clubs = (membershipsWithClubs as Membership[]).map((m) => ({
    id: m.club_id,
    name: m.clubs[0]?.name || 'Unnamed Club',
  }));

  // Determine which club to show
  const params = await searchParams;
  const clubIdFromParams = params.clubId;
  let effectiveClubId = clubs[0].id;
  if (clubIdFromParams && clubs.some((c) => c.id === clubIdFromParams)) {
    effectiveClubId = clubIdFromParams;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  try {
    const { GetClubAnalyticsUseCase } =
      await import('@/application/analytics/club-analytics.use-cases');
    const { DrizzleClubRepository } =
      await import('@/infrastructure/persistence/repositories/club.repository');
    const { DrizzleScheduleRepository } =
      await import('@/infrastructure/persistence/repositories/schedule.repository');
    const { DrizzleTrainerRepository } =
      await import('@/infrastructure/persistence/repositories/trainer.repository');
    const { DrizzleCourtRepository } =
      await import('@/infrastructure/persistence/repositories/court.repository');
    const { DrizzleBookingRepository } =
      await import('@/infrastructure/persistence/repositories/booking.repository');

    const getClubAnalyticsUseCase = new GetClubAnalyticsUseCase(
      new DrizzleClubRepository(),
      new DrizzleScheduleRepository(),
      new DrizzleTrainerRepository(),
      new DrizzleCourtRepository(),
      new DrizzleBookingRepository()
    );

    const kpis = await getClubAnalyticsUseCase.execute(effectiveClubId, startDate, endDate);

    // Map ClubKPIs to AnalyticsData expected by AnalyticsClient
    const analyticsData = {
      totalMembers: kpis.metrics.totalMembers,
      totalBookings: kpis.metrics.bookings.total,
      totalRevenue: kpis.metrics.revenue,
      totalSessions: kpis.metrics.totalSessions,
      revenueByClub: [{ club: kpis.name, revenue: kpis.metrics.revenue }],
      bookingsOverTime: kpis.trends.bookingVolumeByWeek.map((w) => ({
        date: w.week,
        bookings: w.bookings,
      })),
      sessionsPerTrainer: kpis.sessionsPerTrainer.map((t) => ({
        trainer: t.trainerName,
        sessions: t.sessions,
      })),
      capacityUtilization: kpis.capacityUtilization.map((c) => ({
        court: c.courtName,
        util: c.util,
      })),
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Vereinsanalyse</h1>
            <p className="text-gray-500">{clubs.find((c) => c.id === effectiveClubId)?.name}</p>
          </div>
          {clubs.length > 1 && <ClubSelector clubs={clubs} selectedClubId={effectiveClubId} />}
        </div>

        <AnalyticsClient data={analyticsData} />
      </div>
    );
  } catch (error) {
    console.error('Error loading analytics:', error);
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analytics</h1>
        <p className="text-red-500">
          Fehler beim Laden der Vereinsstatistiken. Bitte versuchen Sie es später erneut oder
          kontaktieren Sie den Support.
        </p>
      </div>
    );
  }
}
