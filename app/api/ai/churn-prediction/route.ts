import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * KI Churn Prediction API
 * Identifies members at risk of leaving based on attendance drop, payment delays, and inactivity
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const clubId = membership.club_id;

    // Fetch active members
    const { data: members } = await (supabase as any)
      .from('user_club_memberships')
      .select('user_id, users(full_name, email), created_at')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (!members || (members as any[]).length === 0) {
      return NextResponse.json({ atRisk: [], churnRiskRate: 0 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const atRisk: any[] = [];

    for (const m of members as any[]) {
      let riskScore = 0;
      const reasons: string[] = [];

      // 1. Check recent attendance
      const { count: recentAttendance } = await (supabase as any)
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('participant_id', m.user_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if ((recentAttendance || 0) === 0) {
        riskScore += 40;
        reasons.push('Keine Anwesenheit in den letzten 30 Tagen');
      }

      // 2. Check booking activity decline
      const { count: recentBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', m.user_id)
        .gte('booked_at', thirtyDaysAgo.toISOString());

      const { count: olderBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', m.user_id)
        .lt('booked_at', thirtyDaysAgo.toISOString())
        .gte('booked_at', sixtyDaysAgo.toISOString());

      if ((recentBookings || 0) < (olderBookings || 0) * 0.5) {
        riskScore += 25;
        reasons.push('Buchungsaktivität stark rückläufig');
      }

      // 3. Check open invoices
      const { count: openInvoices } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', m.user_id)
        .eq('status', 'open')
        .lt('due_date', new Date().toISOString());

      if ((openInvoices || 0) > 0) {
        riskScore += 35;
        reasons.push('Überfällige Rechnungen');
      }

      if (riskScore >= 50) {
        atRisk.push({
          userId: m.user_id,
          name: (m.users as any)?.full_name || 'Unbekannt',
          email: (m.users as any)?.email || '',
          riskScore,
          reasons,
          riskLevel: (riskScore >= 70 ? 'high' : riskScore >= 50 ? 'medium' : 'low') as string,
        });
      }
    }

    // Sort by highest risk
    atRisk.sort((a, b) => b.riskScore - a.riskScore);

    return NextResponse.json({
      atRisk: atRisk.slice(0, 20),
      churnRiskRate:
        members.length > 0 ? Math.round((atRisk.length / (members as any[]).length) * 100) : 0,
      totalMembers: (members as any[]).length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
