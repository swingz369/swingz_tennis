import { NextRequest, NextResponse } from 'next/server';
import { GetClubAnalyticsUseCase } from '@/application/analytics/club-analytics.use-cases';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { DrizzleCourtRepository } from '@/infrastructure/persistence/repositories/court.repository';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';

// Helper: Check for demo mode cookie
function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

// Mock analytics data for demo
const DEMO_ANALYTICS = {
  success: true,
  data: {
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
  },
};

export async function GET(___request: NextRequest) {
  const { searchParams } = new URL(__request.url);
  const clubId = searchParams.get('clubId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!clubId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Demo mode: return mock analytics
  if (isDemoMode(_request)) {
    return NextResponse.json(DEMO_ANALYTICS);
  }

  try {
    const clubRepository = new DrizzleClubRepository();
    const scheduleRepository = new DrizzleScheduleRepository();
    const trainerRepository = new DrizzleTrainerRepository();
    const courtRepository = new DrizzleCourtRepository();
    const bookingRepository = new DrizzleBookingRepository();

    const useCase = new GetClubAnalyticsUseCase(
      clubRepository,
      scheduleRepository,
      trainerRepository,
      courtRepository,
      bookingRepository
    );
    const analytics = await useCase.execute(clubId, new Date(startDate), new Date(endDate));

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
