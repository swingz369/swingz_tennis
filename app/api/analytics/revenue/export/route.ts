import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { AnalyticsService } from '@/application/services/analytics.service';
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

    const { searchParams } = new URL(_request.url);
    const format = searchParams.get('format') || 'csv';

    // Wie bei den anderen Exporten: aktiver Verein als Normalfall
    // (PRODUKTIONSREIFE.md 3.5).
    const requested = searchParams.get('clubId');
    const clubId = requested ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }
    if (requested && requested !== auth.clubId && !(await verifyRole(auth, 'superadmin'))) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const revenue = await new AnalyticsService(auth).revenue(clubId);

      if (format === 'pdf') {
        return generatePDFExport(revenue, clubId);
      }

      const csv = convertRevenueToCSV(revenue);
      return new NextResponse(csv, { headers: csvHeaders(`umsaetze-${clubId}`) });
    } catch (_error) {
      return internalErrorResponse();
    }
  });
}

function convertRevenueToCSV(data: {
  totalRevenue: number;
  payments: Array<Record<string, unknown>>;
  monthlyBreakdown: Array<Record<string, unknown>>;
}): string {
  // Zwei Tabellen in einer Datei, durch eine Leerzeile getrennt — Zahlungen
  // im Detail, darunter die Monatssummen.
  const zahlungen = toCsv(data.payments, [
    ['id', 'ID'],
    ['memberName', 'Mitglied'],
    ['amount', 'Betrag (EUR)'],
    ['date', 'Datum'],
    ['time', 'Uhrzeit'],
    ['method', 'Zahlungsmethode'],
  ]);
  const monate = toCsv(data.monthlyBreakdown, [
    ['month', 'Monat'],
    ['revenue', 'Umsatz (EUR)'],
  ]);
  // Das BOM der zweiten Tabelle muss weg — es gehoert nur an den Dateianfang.
  return `${zahlungen}\r\n\r\n${monate.replace(/^\uFEFF/, '')}`;
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
    h1 { color: #00599F; }
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
