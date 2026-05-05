import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { AnalyticsClient } from './analytics-client';
import { ClubSelector } from './club-selector';
import type { AnalyticsData } from './analytics-client';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  // Resolve searchParams early
  const params = await searchParams;
  const clubIdFromParams = params.clubId;

  let analyticsData: AnalyticsData | null = null;
  let clubs: Array<{ id: string; name: string }> = [];

  if (hasDemoMode) {
    analyticsData = {
      totalMembers: 120,
      totalBookings: 450,
      totalRevenue: 12500,
      totalSessions: 85,
      revenueByClub: [{ club: 'Demo Tennis Club', revenue: 12500 }],
      bookingsOverTime: [
        { date: '2025-W01', bookings: 45 },
        { date: '2025-W02', bookings: 52 },
        { date: '2025-W03', bookings: 48 },
        { date: '2025-W04', bookings: 61 },
      ],
      sessionsPerTrainer: [
        { trainer: 'Max Mustermann', sessions: 22 },
        { trainer: 'Anna Schmidt', sessions: 18 },
        { trainer: 'Tom Müller', sessions: 15 },
      ],
      capacityUtilization: [
        { court: 'Platz 1', util: 78 },
        { court: 'Platz 2', util: 65 },
        { court: 'Platz 3', util: 82 },
        { court: 'Platz 4', util: 71 },
        { court: 'Platz 5', util: 55 },
      ],
    };
    clubs = [{ id: 'demo-club', name: 'Demo Tennis Club' }];
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Get all active club memberships with club details
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('club_id, clubs (id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) {
      analyticsData = null;
    } else {
      // Build clubs list
      clubs = memberships.map((m) => ({
        id: m.club_id,
        name: (m.clubs as any)?.name || 'Unnamed Club',
      }));

      // Determine which club to show
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

        const clubRepo = new DrizzleClubRepository();
        const scheduleRepo = new DrizzleScheduleRepository();
        const trainerRepo = new DrizzleTrainerRepository();
        const courtRepo = new DrizzleCourtRepository();
        const bookingRepo = new DrizzleBookingRepository();
        const useCase = new GetClubAnalyticsUseCase(
          clubRepo,
          scheduleRepo,
          trainerRepo,
          courtRepo,
          bookingRepo
        );
        const result = await useCase.execute(effectiveClubId, startDate, endDate);

        analyticsData = {
          totalMembers: result.metrics.totalMembers,
          totalSessions: result.metrics.totalSessions,
          totalRevenue: result.metrics.revenue,
          totalBookings: result.metrics.bookings.total,
          revenueByClub: [{ club: result.name, revenue: result.metrics.revenue }],
          bookingsOverTime: result.trends.bookingVolumeByWeek.map((b) => ({
            date: b.week,
            bookings: b.bookings,
          })),
          sessionsPerTrainer: result.sessionsPerTrainer.map((t) => ({
            trainer: t.trainerName,
            sessions: t.sessions,
          })),
          capacityUtilization: result.capacityUtilization.map((c) => ({
            court: c.courtName,
            util: c.util,
          })),
        } satisfies AnalyticsData;
      } catch (err) {
        console.error('Analytics fetch error:', err);
        return (
          <div className="p-6">
            <div className="text-center py-12 text-gray-500">
              Fehler beim Laden der Vereinsstatistiken. Bitte versuchen Sie es später erneut oder
              kontaktieren Sie den Support.
            </div>
          </div>
        );
      }
    }
  }

  if (!analyticsData) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">
          Sie sind keiner Vereins zugeordnet. Bitte wenden Sie sich an den Superadmin, um einem
          Verein zugewiesen zu werden.
        </div>
      </div>
    );
  }

  // Determine selected club ID for ClubSelector
  const selectedClubId =
    clubIdFromParams && clubs.some((c) => c.id === clubIdFromParams)
      ? clubIdFromParams
      : clubs[0].id;

  return (
    <div className="p-6 space-y-6">
      {/* Header with Club Selector for superadmin/multi-club */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Analytics</h1>
          <p className="text-gray-500">Vereinsstatistiken und Leistungskennzahlen</p>
        </div>
        <ClubSelector clubs={clubs} selectedClubId={selectedClubId} />
      </div>
      <AnalyticsClient data={analyticsData} />
    </div>
  );
}
