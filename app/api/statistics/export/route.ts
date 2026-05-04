import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { StatisticsService } from '@/src/application/services/statistics.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimitStrict);
    if (rateLimitError) return rateLimitError;

    try {
      const searchParams = req.nextUrl.searchParams;
      const format = (searchParams.get('format') || 'pdf') as 'pdf' | 'excel' | 'csv';
      const period = (searchParams.get('period') || 'monthly') as
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly';

      const statisticsService = new StatisticsService();
      const statistics = await statisticsService.generateStatistics(period, new Date(), new Date());

      let content: string;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv':
          content = convertToCSV(statistics);
          contentType = 'text/csv';
          filename = `statistics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'excel':
          content = convertToExcel(statistics);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `statistics-${period}-${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case 'pdf':
        default:
          content = convertToPDF(statistics);
          contentType = 'application/pdf';
          filename = `statistics-${period}-${new Date().toISOString().split('T')[0]}.pdf`;
          break;
      }

      return new NextResponse(content, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error('Error exporting statistics:', error);
      return NextResponse.json({ error: 'Failed to export statistics' }, { status: 500 });
    }
  });
}

function convertToCSV(statistics: any): string {
  const rows = [
    ['Statistik', 'Wert'],
    ['Zeitraum', statistics.period],
    ['Startdatum', statistics.startDate],
    ['Enddatum', statistics.endDate],
    [],
    ['Mitgliederstatistiken'],
    ['Gesamtmitglieder', statistics.memberStats.totalMembers],
    ['Aktive Mitglieder', statistics.memberStats.activeMembers],
    ['Inaktive Mitglieder', statistics.memberStats.inactiveMembers],
    ['Probemitglieder', statistics.memberStats.trialMembers],
    ['Neue Mitglieder', statistics.memberStats.newMembers],
    ['Konvertierte Probetrainings', statistics.memberStats.convertedTrials],
    ['Konversionsrate (%)', statistics.memberStats.conversionRate.toFixed(2)],
    [],
    ['Umsatzstatistiken'],
    ['Gesamtumsatz (€)', statistics.revenueStats.totalRevenue.toFixed(2)],
    ['Mitgliedschaftsumsatz (€)', statistics.revenueStats.membershipRevenue.toFixed(2)],
    ['Trainingsumsatz (€)', statistics.revenueStats.trainingRevenue.toFixed(2)],
    ['Platzumsatz (€)', statistics.revenueStats.courtRevenue.toFixed(2)],
    ['Sonstiger Umsatz (€)', statistics.revenueStats.otherRevenue.toFixed(2)],
    [
      'Durchschnittlicher Umsatz pro Mitglied (€)',
      statistics.revenueStats.averageRevenuePerMember.toFixed(2),
    ],
    ['Ausstehende Zahlungen (€)', statistics.revenueStats.pendingPayments.toFixed(2)],
    ['Überfällige Zahlungen (€)', statistics.revenueStats.overduePayments.toFixed(2)],
    [],
    ['Platzstatistiken'],
    ['Gesamtplätze', statistics.courtStats.totalCourts],
    ['Gesamtbuchungen', statistics.courtStats.totalBookings],
    ['Auslastungsrate (%)', statistics.courtStats.utilizationRate],
    ['Durchschnittliche Tagesbuchungen', statistics.courtStats.averageDailyBookings],
    ['Stornierte Buchungen', statistics.courtStats.cancelledBookings],
    ['No-Show-Rate (%)', statistics.courtStats.noShowRate],
    [],
    ['Trainerstatistiken'],
    ['Gesamttrainer', statistics.trainerStats.totalTrainers],
    ['Aktive Trainer', statistics.trainerStats.activeTrainers],
    ['Gesamtstunden', statistics.trainerStats.totalHours],
    [
      'Durchschnittliche Stunden pro Trainer',
      statistics.trainerStats.averageHoursPerTrainer.toFixed(2),
    ],
    ['Gesamtsitzungen', statistics.trainerStats.totalSessions],
    [
      'Durchschnittliche Sitzungen pro Trainer',
      statistics.trainerStats.averageSessionsPerTrainer.toFixed(2),
    ],
  ];

  return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

function convertToExcel(statistics: any): string {
  return JSON.stringify(statistics, null, 2);
}

function convertToPDF(statistics: any): string {
  return JSON.stringify(statistics, null, 2);
}
