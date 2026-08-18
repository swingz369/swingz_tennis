import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { getClubBookingsUseCase } from '@/application/bookings/get-club-bookings.use-case';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { toCsv, csvHeaders } from '@/lib/csv';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Wie beim Mitglieder-Export: der aktive Verein ist der Normalfall,
    // clubId bleibt fuer den Superadmin (PRODUKTIONSREIFE.md 3.5).
    const requested = new URL(_request.url).searchParams.get('clubId');
    const clubId = requested ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }
    if (requested && requested !== auth.clubId && !(await verifyRole(auth, 'superadmin'))) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const bookingRepository = new DrizzleBookingRepository();
      const clubRepository = new DrizzleClubRepository();
      const scheduleRepository = new DrizzleScheduleRepository();
      const useCase = getClubBookingsUseCase(bookingRepository, clubRepository, scheduleRepository);
      const bookings = await useCase.execute(clubId);

      const csv = toCsv(bookings as unknown as Record<string, unknown>[]);
      return new NextResponse(csv, { headers: csvHeaders(`buchungen-${clubId}`) });
    } catch (_error) {
      return internalErrorResponse();
    }
  });
}
