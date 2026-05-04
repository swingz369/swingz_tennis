import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { AnalyticsClient } from './analytics-client';
import type { AnalyticsData } from './analytics-client';

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let analyticsData: AnalyticsData | null = null;

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
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!memberships || memberships.length === 0) {
      analyticsData = null;
    } else {
      const clubId = memberships[0].club_id;
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
        const result = await useCase.execute(clubId, startDate, endDate);

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

  return <AnalyticsClient data={analyticsData} />;
}
