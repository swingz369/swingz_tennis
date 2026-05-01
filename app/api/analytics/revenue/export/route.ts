import { NextRequest, NextResponse } from 'next/server';
import { getClubRevenueUseCase } from '@/application/analytics/get-club-revenue.use-case';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';

function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

const DEMO_REVENUE = {
  totalRevenue: 12500,
  payments: [
    {
      id: 'p1',
      memberName: 'Max Mustermann',
      amount: 150,
      date: '2025-01-10',
      method: 'Kreditkarte',
      time: '10:00',
    },
    {
      id: 'p2',
      memberName: 'Anna Schmidt',
      amount: 150,
      date: '2025-01-11',
      method: 'Lastschrift',
      time: '14:00',
    },
    {
      id: 'p3',
      memberName: 'Tom Müller',
      amount: 200,
      date: '2025-01-12',
      method: 'Kreditkarte',
      time: '09:00',
    },
    {
      id: 'p4',
      memberName: 'Lisa Weber',
      amount: 150,
      date: '2025-01-13',
      method: 'Bar',
      time: '16:00',
    },
  ],
  monthlyBreakdown: [
    { month: 'Jan', revenue: 4200 },
    { month: 'Feb', revenue: 3800 },
    { month: 'Mar', revenue: 4500 },
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');
  const format = searchParams.get('format') || 'csv';

  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  if (isDemoMode(request)) {
    if (format === 'pdf') {
      return generatePDFExport(DEMO_REVENUE, clubId);
    }
    const csv = convertRevenueToCSV(DEMO_REVENUE);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="revenue-export.csv"',
      },
    });
  }

  try {
    const bookingRepository = new DrizzleBookingRepository();
    const clubRepository = new DrizzleClubRepository();
    const scheduleRepository = new DrizzleScheduleRepository();
    const useCase = getClubRevenueUseCase(bookingRepository, clubRepository, scheduleRepository);
    const revenue = await useCase.execute(clubId);

    if (format === 'pdf') {
      return generatePDFExport(revenue, clubId);
    }

    const csv = convertRevenueToCSV(revenue);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="revenue-${clubId}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function convertRevenueToCSV(data: {
  totalRevenue: number;
  payments: Array<Record<string, unknown>>;
  monthlyBreakdown: Array<Record<string, unknown>>;
}): string {
  const paymentHeaders = ['ID', 'Mitglied', 'Betrag (EUR)', 'Datum', 'Uhrzeit', 'Zahlungsmethode'];
  const paymentRows = [paymentHeaders.join(',')];

  for (const payment of data.payments) {
    const values = [
      payment.id,
      payment.memberName,
      payment.amount,
      payment.date,
      payment.time,
      payment.method,
    ]
      .map((v) => `"${v}"`)
      .join(',');
    paymentRows.push(values);
  }

  paymentRows.push('');
  const monthlyHeaders = ['Monat', 'Umsatz (EUR)'];
  paymentRows.push(monthlyHeaders.join(','));
  for (const month of data.monthlyBreakdown) {
    paymentRows.push(`"${month.month}","${month.revenue}"`);
  }

  return paymentRows.join('\n');
}

function generatePDFExport(
  data: { totalRevenue: number; payments: Array<Record<string, unknown>> },
  clubId: string
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Revenue Report</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1B4332; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Umsatzbericht</h1>
  <p><strong>Club ID:</strong> ${clubId}</p>
  <p><strong>Gesamtumsatz:</strong> €${data.totalRevenue.toFixed(2)}</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Mitglied</th><th>Betrag</th><th>Datum</th><th>Uhrzeit</th><th>Zahlungsmethode</th></tr>
    </thead>
    <tbody>
      ${data.payments
        .map(
          (p: Record<string, unknown>) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.memberName}</td>
          <td>€${p.amount}</td>
          <td>${p.date}</td>
          <td>${p.time}</td>
          <td>${p.method}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  <script>window.print();</script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="revenue-${clubId}.pdf"`,
    },
  });
}
