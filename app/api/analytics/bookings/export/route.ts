import { NextRequest, NextResponse } from 'next/server';
import { getClubBookingsUseCase } from '@/application/bookings/get-club-bookings.use-case';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';

function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

const DEMO_BOOKINGS = [
  {
    id: 'b1',
    memberName: 'Max Mustermann',
    date: '2025-01-15',
    time: '10:00',
    court: 'Platz 1',
    status: 'Bestätigt',
  },
  {
    id: 'b2',
    memberName: 'Anna Schmidt',
    date: '2025-01-16',
    time: '14:00',
    court: 'Platz 2',
    status: 'Bestätigt',
  },
  {
    id: 'b3',
    memberName: 'Tom Müller',
    date: '2025-01-17',
    time: '09:00',
    court: 'Platz 3',
    status: 'Storniert',
  },
  {
    id: 'b4',
    memberName: 'Lisa Weber',
    date: '2025-01-18',
    time: '16:00',
    court: 'Platz 1',
    status: 'Bestätigt',
  },
  {
    id: 'b5',
    memberName: 'Mike Berger',
    date: '2025-01-19',
    time: '11:00',
    court: 'Platz 4',
    status: 'Warteliste',
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  if (isDemoMode(request)) {
    const csv = convertToCSV(DEMO_BOOKINGS);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="bookings-export.csv"',
      },
    });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function convertToCSV(data: object[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];
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
