import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { AnalyticsService } from '@/application/services/analytics.service';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
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
    if (format !== 'csv') {
      return NextResponse.json({ error: 'Nur CSV-Export wird unterstützt' }, { status: 400 });
    }

    // Wie bei den anderen Exporten: aktiver Verein als Normalfall
    // (PRODUKTIONSREIFE.md 3.5).
    const requested = searchParams.get('clubId');
    const clubId = requested ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const revenue = await new AnalyticsService(auth).revenue(clubId);

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
    ['memberId', 'Mitglieds-ID'],
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
