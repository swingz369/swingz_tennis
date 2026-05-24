import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

export interface TrainerSummary {
  trainerId: string;
  name: string;
  hours: number;
  hourlyRate: number;
  amount: number;
}

export interface MonthlyOverviewResponse {
  month: string;
  trainers: TrainerSummary[];
  totalRevenue: number;
  totalPaid: number;
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId') || auth.clubId;
    const month = searchParams.get('month'); // YYYY-MM

    if (!clubId) {
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }

    // Default to current month if not provided
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1).toISOString();
    const monthEnd = new Date(year, mon, 1).toISOString();

    // Query approved hours_logs for the month, joined with trainer_profiles for name + hourly_rate
    const { data: hoursData, error: hoursError } = await supabase
      .from('hours_logs')
      .select(
        `
        trainer_id,
        trainer_name,
        duration,
        trainer_profiles!inner(hourly_rate, club_id)
      `
      )
      .eq('status', 'approved')
      .eq('trainer_profiles.club_id', clubId)
      .gte('date', monthStart)
      .lt('date', monthEnd);

    if (hoursError) {
      console.error('[monthly-overview] hours_logs query failed:', hoursError);
      return NextResponse.json({ error: 'Fehler beim Laden der Stunden' }, { status: 500 });
    }

    // Aggregate hours per trainer
    const trainerMap = new Map<
      string,
      { name: string; totalMinutes: number; hourlyRate: number }
    >();

    for (const row of hoursData ?? []) {
      const existing = trainerMap.get(row.trainer_id);
      const profiles = Array.isArray(row.trainer_profiles)
        ? row.trainer_profiles[0]
        : row.trainer_profiles;
      const hourlyRate: number = profiles?.hourly_rate ?? 0;

      if (existing) {
        existing.totalMinutes += row.duration ?? 0;
      } else {
        trainerMap.set(row.trainer_id, {
          name: row.trainer_name,
          totalMinutes: row.duration ?? 0,
          hourlyRate,
        });
      }
    }

    const trainers: TrainerSummary[] = Array.from(trainerMap.entries()).map(([trainerId, data]) => {
      const hours = data.totalMinutes / 60;
      return {
        trainerId,
        name: data.name,
        hours: Math.round(hours * 100) / 100,
        hourlyRate: data.hourlyRate,
        amount: Math.round(hours * data.hourlyRate * 100) / 100,
      };
    });

    // Query invoices for monthly revenue totals
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('amount, status')
      .eq('club_id', clubId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (invoicesError) {
      console.error('[monthly-overview] invoices query failed:', invoicesError);
      return NextResponse.json({ error: 'Fehler beim Laden der Rechnungen' }, { status: 500 });
    }

    const totalRevenue = (invoicesData ?? []).reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const totalPaid = (invoicesData ?? [])
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

    const response: MonthlyOverviewResponse = {
      month: targetMonth,
      trainers,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
    };

    return NextResponse.json(response);
  });
}
