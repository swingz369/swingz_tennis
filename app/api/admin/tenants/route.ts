import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { createClient } from '@/infrastructure/external/supabase/client';

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    // Only superadmin can access tenant overview
    if (auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const supabase = createClient();

    try {
      // Fetch all clubs with basic statistics in a single query
      const { data: clubs, error } = await supabase
        .from('clubs')
        .select(
          `
          id,
          name,
          status,
          max_members,
          user_club_memberships(count),
          sessions(count)
        `
        )
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching clubs:', error);
        throw new Error('Failed to fetch clubs');
      }

      // Get all club IDs for batch queries
      const clubIds = clubs.map((club: any) => club.id);

      // Batch fetch trainer counts
      const { data: trainerCounts } = await supabase
        .from('trainer_profiles')
        .select('club_id')
        .in('club_id', clubIds);

      const trainerCountMap = new Map<string, number>();
      trainerCounts?.forEach((trainer: any) => {
        trainerCountMap.set(trainer.club_id, (trainerCountMap.get(trainer.club_id) || 0) + 1);
      });

      // Batch fetch revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('club_id, total_amount')
        .in('club_id', clubIds)
        .eq('status', 'paid')
        .gte('paid_at', thirtyDaysAgo.toISOString());

      const revenueMap = new Map<string, number>();
      invoices?.forEach((invoice: any) => {
        const current = revenueMap.get(invoice.club_id) || 0;
        revenueMap.set(invoice.club_id, current + Number(invoice.total_amount));
      });

      // Map to simplified stats
      const clubsWithStats = clubs.map((club: any) => ({
        id: club.id,
        name: club.name,
        member_count: club.user_club_memberships?.[0]?.count || 0,
        trainer_count: trainerCountMap.get(club.id) || 0,
        active_sessions: club.sessions?.[0]?.count || 0,
        max_members: club.max_members,
        status: club.status,
        revenue: revenueMap.get(club.id) || 0,
      }));

      return NextResponse.json({ clubs: clubsWithStats });
    } catch (error) {
      console.error('Tenant fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
