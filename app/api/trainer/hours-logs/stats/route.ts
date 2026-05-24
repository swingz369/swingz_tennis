/**
 * GET /api/trainer/hours-logs/stats — Aggregierte Stunden-Statistiken für Trainer
 *
 * Liefert Statistiken für die aktuelle Woche und den aktuellen Monat mit
 * täglicher Aufschlüsselung und Trend-Vergleich zur Vorperiode.
 *
 * Query-Parameter:
 *   - trainerId (optional, nur für Admins): Filtert auf bestimmten Trainer
 *
 * Response:
 *   {
 *     trainerId: string,
 *     period: {
 *       week: { startDate, endDate, stats: PeriodStats, trend: number },
 *       month: { startDate, endDate, stats: PeriodStats, trend: number }
 *     },
 *     dailyBreakdown: DailyBreakdown[]
 *   }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

interface PeriodStats {
  totalHours: number;
  totalEntries: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  approvedEntries: number;
  pendingEntries: number;
  rejectedEntries: number;
  byType: Record<string, { hours: number; entries: number }>;
}

interface DailyBreakdown {
  date: string;
  dayOfWeek: string;
  hours: number;
  entries: number;
  status: string;
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isTrainer) {
      return forbiddenResponse('Trainer-Zugriff erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = new URL(_request.url);
      const requestedTrainerId = searchParams.get('trainerId');

      // Admins können Stats für jeden Trainer abrufen; Trainer nur ihre eigenen
      const isAdmin = await verifyRole(auth, 'admin');
      const targetTrainerId = requestedTrainerId && isAdmin ? requestedTrainerId : auth.user.id;

      const now = new Date();

      // --- Datumsberechnungen ---

      // Aktuelle ISO-Woche: Montag–Sonntag
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, …
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const weekStart = toDateStr(monday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekEnd = toDateStr(sunday);

      // Aktueller Monat
      const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

      // Vorwoche
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      const prevWeekStart = toDateStr(prevMonday);
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);
      const prevWeekEnd = toDateStr(prevSunday);

      // Vormonat
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStartStr = toDateStr(prevMonthStart);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
      const prevMonthEndStr = toDateStr(prevMonthEnd);

      const supabase = auth.supabase;

      // --- Hilfsfunktionen ---

      async function fetchPeriodStats(startDate: string, endDate: string): Promise<PeriodStats> {
        // endDate exklusiv behandeln: +1 Tag
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        const endExclusive = toDateStr(end);

        const { data, error } = await supabase
          .from('hours_logs')
          .select('duration, status, type')
          .eq('trainer_id', targetTrainerId)
          .gte('date', startDate)
          .lt('date', endExclusive);

        if (error) {
          console.error('Period stats fetch error:', error);
          return emptyStats();
        }

        const stats: PeriodStats = {
          totalHours: 0,
          totalEntries: data.length,
          approvedHours: 0,
          pendingHours: 0,
          rejectedHours: 0,
          approvedEntries: 0,
          pendingEntries: 0,
          rejectedEntries: 0,
          byType: {},
        };

        for (const row of data) {
          const hours = (row.duration ?? 0) / 60;
          stats.totalHours += hours;

          switch (row.status) {
            case 'approved':
              stats.approvedHours += hours;
              stats.approvedEntries++;
              break;
            case 'rejected':
              stats.rejectedHours += hours;
              stats.rejectedEntries++;
              break;
            default:
              stats.pendingHours += hours;
              stats.pendingEntries++;
          }

          const type = row.type || 'other';
          if (!stats.byType[type]) {
            stats.byType[type] = { hours: 0, entries: 0 };
          }
          stats.byType[type].hours += hours;
          stats.byType[type].entries++;
        }

        // Runden auf 2 Nachkommastellen
        return roundStats(stats);
      }

      async function fetchDailyBreakdown(
        startDate: string,
        endDate: string
      ): Promise<DailyBreakdown[]> {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        const endExclusive = toDateStr(end);

        const { data, error } = await supabase
          .from('hours_logs')
          .select('date, duration, status')
          .eq('trainer_id', targetTrainerId)
          .gte('date', startDate)
          .lt('date', endExclusive)
          .order('date', { ascending: true });

        if (error) return [];

        const dayMap = new Map<string, { hours: number; entries: number; lastStatus: string }>();

        for (const row of data) {
          const dateKey =
            typeof row.date === 'string'
              ? row.date.substring(0, 10)
              : String(row.date).substring(0, 10);
          const hours = (row.duration ?? 0) / 60;

          const existing = dayMap.get(dateKey);
          if (existing) {
            existing.hours += hours;
            existing.entries++;
            // Letzten Status für diesen Tag merken
            if (row.status) existing.lastStatus = row.status;
          } else {
            dayMap.set(dateKey, {
              hours,
              entries: 1,
              lastStatus: row.status || 'pending',
            });
          }
        }

        const dayNames = [
          'Sonntag',
          'Montag',
          'Dienstag',
          'Mittwoch',
          'Donnerstag',
          'Freitag',
          'Samstag',
        ];

        return Array.from(dayMap.entries()).map(([dateKey, val]) => ({
          date: dateKey,
          dayOfWeek: dayNames[new Date(dateKey).getDay()],
          hours: Math.round(val.hours * 100) / 100,
          entries: val.entries,
          status: val.lastStatus,
        }));
      }

      // --- Alle Daten parallel abrufen ---

      const [currentWeek, currentMonth, previousWeek, previousMonth, dailyBreakdown] =
        await Promise.all([
          fetchPeriodStats(weekStart, weekEnd),
          fetchPeriodStats(monthStart, weekEnd), // bis heute im Monat
          fetchPeriodStats(prevWeekStart, prevWeekEnd),
          fetchPeriodStats(prevMonthStartStr, prevMonthEndStr),
          fetchDailyBreakdown(weekStart, weekEnd),
        ]);

      // Trends berechnen
      const weekTrend = calcTrend(previousWeek.totalHours, currentWeek.totalHours);
      const monthTrend = calcTrend(previousMonth.totalHours, currentMonth.totalHours);

      return NextResponse.json({
        trainerId: targetTrainerId,
        period: {
          week: {
            startDate: weekStart,
            endDate: weekEnd,
            stats: currentWeek,
            trend: weekTrend,
          },
          month: {
            startDate: monthStart,
            stats: currentMonth,
            trend: monthTrend,
          },
        },
        dailyBreakdown,
      });
    } catch (error) {
      console.error('Hours stats fetch error:', error);
      return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
    }
  });
}

// --- Hilfsfunktionen ---

function toDateStr(d: Date): string {
  return d.toISOString().substring(0, 10);
}

function emptyStats(): PeriodStats {
  return {
    totalHours: 0,
    totalEntries: 0,
    approvedHours: 0,
    pendingHours: 0,
    rejectedHours: 0,
    approvedEntries: 0,
    pendingEntries: 0,
    rejectedEntries: 0,
    byType: {},
  };
}

function roundStats(s: PeriodStats): PeriodStats {
  return {
    ...s,
    totalHours: Math.round(s.totalHours * 100) / 100,
    approvedHours: Math.round(s.approvedHours * 100) / 100,
    pendingHours: Math.round(s.pendingHours * 100) / 100,
    rejectedHours: Math.round(s.rejectedHours * 100) / 100,
    byType: Object.fromEntries(
      Object.entries(s.byType).map(([key, val]) => [
        key,
        { hours: Math.round(val.hours * 100) / 100, entries: val.entries },
      ])
    ),
  };
}

function calcTrend(previous: number, current: number): number {
  if (previous > 0) {
    return Math.round(((current - previous) / previous) * 100);
  }
  return current > 0 ? 100 : 0;
}
