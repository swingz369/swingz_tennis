import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api-analytics');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can view analytics
    const isTrainer = await verifyRole(auth, 'trainer');
    const isAdmin = await verifyRole(auth, 'admin');
    const hasPermission = isTrainer || isAdmin;
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId') || auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'Pflichtparameter fehlt: clubId' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      // Service client: analytics aggregates read across tables (invoices, groups,
      // bookings) that RLS does not uniformly expose to trainers — access is already
      // gated above via verifyRole/verifyClubAccess.
      const supabase = createServiceClient();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [
        { count: totalMembers },
        { count: activeMembers },
        { data: courts },
        { count: totalBookings },
        { data: sessionsData },
        { data: paidInvoices },
        { data: openInvoices },
        { data: groupsData },
        { data: recentPaidInvoices },
      ] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .not('role', 'in', '(trainer,superadmin)'),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .eq('is_active', true)
          .not('role', 'in', '(trainer,superadmin)'),
        supabase.from('courts').select('id').eq('club_id', clubId).eq('is_active', true),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId),
        supabase
          .from('sessions')
          .select('id, court_id, schedules!inner(club_id)')
          .eq('schedules.club_id', clubId)
          .limit(500),
        supabase.from('invoices').select('amount').eq('club_id', clubId).eq('status', 'paid'),
        supabase
          .from('invoices')
          .select('amount')
          .eq('club_id', clubId)
          .in('status', ['sent', 'overdue']),
        supabase.from('groups').select('name, member_ids').eq('club_id', clubId),
        supabase
          .from('invoices')
          .select('amount, invoice_date')
          .eq('club_id', clubId)
          .eq('status', 'paid')
          .gte('invoice_date', sixMonthsAgo.toISOString().split('T')[0]),
      ]);

      const sumAmount = (rows: { amount: number | string | null }[] | null) =>
        (rows ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

      const courtSessionCounts = new Map<string, number>();
      (sessionsData ?? []).forEach((s: { court_id?: string | null }) => {
        if (s.court_id) {
          courtSessionCounts.set(s.court_id, (courtSessionCounts.get(s.court_id) ?? 0) + 1);
        }
      });
      const totalSessionCount = sessionsData?.length ?? 0;
      const courtUtils = (courts ?? []).map((c: { id: string }) =>
        totalSessionCount > 0
          ? Math.round(((courtSessionCounts.get(c.id) ?? 0) / totalSessionCount) * 100)
          : 0
      );
      const courtUtilization =
        courtUtils.length > 0
          ? Math.round(courtUtils.reduce((sum, u) => sum + u, 0) / courtUtils.length)
          : 0;

      const topGroups = (groupsData ?? [])
        .map((g) => ({
          name: g.name,
          count: Array.isArray(g.member_ids) ? g.member_ids.length : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const revenueByMonthMap = new Map<string, number>();
      (recentPaidInvoices ?? []).forEach(
        (inv: { amount: number | string | null; invoice_date: string }) => {
          const month = inv.invoice_date?.substring(0, 7) ?? '';
          revenueByMonthMap.set(
            month,
            (revenueByMonthMap.get(month) ?? 0) + (Number(inv.amount) || 0)
          );
        }
      );
      const revenueByMonth = Array.from(revenueByMonthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }));

      return NextResponse.json({
        totalMembers: totalMembers ?? 0,
        activeMembers: activeMembers ?? 0,
        totalRevenue: sumAmount(paidInvoices),
        pendingPayments: sumAmount(openInvoices),
        totalBookings: totalBookings ?? 0,
        courtUtilization,
        topGroups,
        revenueByMonth,
      });
    } catch (error) {
      log.error('Failed to load analytics', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Fehler beim Laden der Auswertungen' }, { status: 500 });
    }
  });
}
