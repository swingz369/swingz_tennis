import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GetClubAnalyticsUseCase } from '@/application/analytics/club-analytics.use-cases';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { DrizzleCourtRepository } from '@/infrastructure/persistence/repositories/court.repository';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can view analytics
    const isTrainer = await verifyRole(auth, 'trainer');
    const isAdmin = await verifyRole(auth, 'admin');
    const hasPermission = isTrainer || isAdmin;
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId') || auth.clubId;
    const now = new Date();
    const startDate =
      searchParams.get('startDate') ||
      new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || now.toISOString().split('T')[0];

    if (!clubId) {
      return NextResponse.json({ error: 'Missing required parameter: clubId' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
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
  });
}
