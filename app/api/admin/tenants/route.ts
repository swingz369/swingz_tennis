import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth, verifyRole } from '@/lib/api-auth';
import { createClient } from '@/infrastructure/external/supabase/client';

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    // Only superadmin can access tenant overview
    if (auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const supabase = createClient();

    try {
      // Fetch all clubs with basic statistics
      const { data: clubs, error } = await supabase
        .from('clubs')
        .select(
          `
          id,
          name,
          status,
          max_members,
          club_memberships(count),
          trainers(count),
          sessions(count)
        `
        )
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching clubs:', error);
        return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
      }

      // Map to simplified stats
      const clubsWithStats = clubs.map((club: any) => ({
        id: club.id,
        name: club.name,
        member_count: club.club_memberships?.[0]?.count || 0,
        trainer_count: club.trainers?.[0]?.count || 0,
        active_sessions: club.sessions?.[0]?.count || 0,
        max_members: club.max_members,
        status: club.status,
        // Revenue will be calculated separately (sum of invoices)
        revenue: 0,
      }));

      // Optionally fetch revenue per club (last 30 days)
      // This could be optimized with a DB view or materialized view
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const club of clubsWithStats) {
        const { data: revenueData } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('club_id', club.id)
          .eq('status', 'paid')
          .gte('paid_at', thirtyDaysAgo.toISOString());

        const total = (revenueData ?? []).reduce(
          (sum: number, inv: { total_amount: string | number }) => {
            return sum + Number(inv.total_amount);
          },
          0
        );
        club.revenue = total;
      }

      return NextResponse.json({ clubs: clubsWithStats });
    } catch (error) {
      console.error('Tenant fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
