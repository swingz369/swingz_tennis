import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { getClubBookingsUseCase } from '@/application/bookings/get-club-bookings.use-case';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

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

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }

    try {
      const bookingRepository = new DrizzleBookingRepository();
      const clubRepository = new DrizzleClubRepository();
      const scheduleRepository = new DrizzleScheduleRepository();
      const useCase = getClubBookingsUseCase(bookingRepository, clubRepository, scheduleRepository);
      const bookings = await useCase.execute(clubId);

      const csv = convertToCSV(bookings);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bookings-${clubId}.csv"`,
        },
      });
    } catch (_error) {
      return internalErrorResponse();
    }
  });
}

function convertToCSV(data: object[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      const formatted =
        value instanceof Date
          ? value.toISOString().split('T')[0]
          : String(value ?? '').replace(/"/g, '""');
      return `"${formatted}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
