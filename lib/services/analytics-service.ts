import { createClient } from '@/infrastructure/external/supabase/server';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AnalyticsMetrics {
  // Member metrics
  totalMembers: number;
  activeMembersThisMonth: number;
  newMembersThisMonth: number;
  memberGrowthRate: number;

  // Trainer metrics
  totalTrainers: number;
  activeTrainersThisMonth: number;
  avgTrainerRating: number;

  // Session metrics
  totalSessions: number;
  sessionsThisMonth: number;
  avgSessionAttendance: number;
  sessionCompletionRate: number;

  // Booking metrics
  totalBookings: number;
  bookingsThisMonth: number;
  avgBookingsPerMember: number;
  noShowRate: number;

  // Revenue metrics
  monthlyRevenue: number;
  revenueGrowthRate: number;
  paidRevenueThisMonth: number;
  outstandingRevenue: number;

  // Feedback metrics
  totalFeedback: number;
  avgFeedbackRating: number;
  feedbackResponseRate: number;

  // Monthly trend data for charts
  monthlyData: Array<{
    month: string;
    members: number;
    sessions: number;
    bookings: number;
    revenue: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get comprehensive analytics for a club
   */
  async getClubAnalytics(clubId: string): Promise<AnalyticsMetrics> {
    const supabase = await createClient();

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Fetch all data in parallel
    const [membersData, trainersData, sessionsData, bookingsData, feedbackData, revenueData, monthlyTrendData] =
      await Promise.all([
        this.getMemberMetrics(
          supabase,
          clubId,
          thisMonthStart,
          thisMonthEnd,
          lastMonthStart,
          lastMonthEnd
        ),
        this.getTrainerMetrics(supabase, clubId, thisMonthStart, thisMonthEnd),
        this.getSessionMetrics(supabase, clubId, thisMonthStart, thisMonthEnd),
        this.getBookingMetrics(supabase, clubId, thisMonthStart, thisMonthEnd),
        this.getFeedbackMetrics(supabase, clubId),
        this.getRevenueMetrics(supabase, clubId, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd),
        this.getMonthlyTrends(supabase, clubId),
      ]);

    return {
      ...membersData,
      ...trainersData,
      ...sessionsData,
      ...bookingsData,
      ...feedbackData,
      ...revenueData,
      monthlyData: monthlyTrendData,
    };
  }

  private async getMemberMetrics(
    supabase: SupabaseClient,
    clubId: string,
    thisMonthStart: Date,
    thisMonthEnd: Date,
    lastMonthStart: Date,
    lastMonthEnd: Date
  ) {
    // Total members
    const { count: totalMembers } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true);

    // Active members this month (members who made at least one booking)
    const { count: activeMembersThisMonth } = await supabase
      .from('bookings')
      .select('member_id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    // New members this month
    const { count: newMembersThisMonth } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    // New members last month for growth rate
    const { count: newMembersLastMonth } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    const memberGrowthRate = newMembersLastMonth
      ? (((newMembersThisMonth || 0) - (newMembersLastMonth || 0)) / (newMembersLastMonth || 1)) *
        100
      : 0;

    return {
      totalMembers: totalMembers || 0,
      activeMembersThisMonth: activeMembersThisMonth || 0,
      newMembersThisMonth: newMembersThisMonth || 0,
      memberGrowthRate: Math.round(memberGrowthRate * 10) / 10,
    };
  }

  private async getTrainerMetrics(
    supabase: SupabaseClient,
    clubId: string,
    thisMonthStart: Date,
    thisMonthEnd: Date
  ) {
    // Total trainers
    const { count: totalTrainers } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true);

    // Active trainers this month (trainers who had at least one session)
    const { count: activeTrainersThisMonth } = await supabase
      .from('sessions')
      .select('trainer_id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .gte('date', thisMonthStart.toISOString())
      .lte('date', thisMonthEnd.toISOString());

    // Average trainer rating
    const { data: ratings } = await supabase
      .from('trainer_feedback')
      .select('rating')
      .eq('club_id', clubId)
      .eq('is_visible', true);

    const avgRating = ratings?.length
      ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length
      : 0;

    return {
      totalTrainers: totalTrainers || 0,
      activeTrainersThisMonth: activeTrainersThisMonth || 0,
      avgTrainerRating: Math.round(avgRating * 10) / 10,
    };
  }

  private async getSessionMetrics(
    supabase: SupabaseClient,
    clubId: string,
    thisMonthStart: Date,
    thisMonthEnd: Date
  ) {
    // Total sessions
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    // Sessions this month
    const { count: sessionsThisMonth } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .gte('date', thisMonthStart.toISOString())
      .lte('date', thisMonthEnd.toISOString());

    // For attendance and completion, we'd need booking data
    // Simplified for now
    const { data: sessionBookings } = await supabase
      .from('bookings')
      .select('session_id, status')
      .eq('club_id', clubId)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const confirmedBookings =
      sessionBookings?.filter((b: { status: string }) => b.status === 'confirmed').length || 0;
    const completedSessions = sessionBookings?.length || 1;

    return {
      totalSessions: totalSessions || 0,
      sessionsThisMonth: sessionsThisMonth || 0,
      avgSessionAttendance: Math.round((confirmedBookings / completedSessions) * 10) / 10,
      sessionCompletionRate: Math.round((confirmedBookings / completedSessions) * 100 * 10) / 10,
    };
  }

  private async getBookingMetrics(
    supabase: SupabaseClient,
    clubId: string,
    thisMonthStart: Date,
    thisMonthEnd: Date
  ) {
    // Total bookings
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    // Bookings this month
    const { count: bookingsThisMonth } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    // Members count for avg bookings
    const { count: totalMembers } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true);

    // No-show rate
    const { count: noShows } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('status', 'no_show')
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString());

    const noShowRate = bookingsThisMonth ? ((noShows || 0) / (bookingsThisMonth || 1)) * 100 : 0;

    return {
      totalBookings: totalBookings || 0,
      bookingsThisMonth: bookingsThisMonth || 0,
      avgBookingsPerMember: totalMembers
        ? Math.round(((totalBookings || 0) / totalMembers) * 10) / 10
        : 0,
      noShowRate: Math.round(noShowRate * 10) / 10,
    };
  }

  private async getRevenueMetrics(
    supabase: SupabaseClient,
    clubId: string,
    thisMonthStart: Date,
    thisMonthEnd: Date,
    lastMonthStart: Date,
    lastMonthEnd: Date
  ) {
    // Revenue this month: sum of paid invoices created this month
    const { data: thisMonthPaid } = await supabase
      .from('invoices')
      .select('paid_amount')
      .eq('club_id', clubId)
      .eq('status', 'paid')
      .gte('paid_at', thisMonthStart.toISOString())
      .lte('paid_at', thisMonthEnd.toISOString());

    const monthlyRevenue = (thisMonthPaid || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.paid_amount) || 0),
      0
    );

    // Revenue last month for growth rate
    const { data: lastMonthPaid } = await supabase
      .from('invoices')
      .select('paid_amount')
      .eq('club_id', clubId)
      .eq('status', 'paid')
      .gte('paid_at', lastMonthStart.toISOString())
      .lte('paid_at', lastMonthEnd.toISOString());

    const lastMonthRevenue = (lastMonthPaid || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.paid_amount) || 0),
      0
    );

    const revenueGrowthRate = lastMonthRevenue > 0
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Outstanding revenue: unpaid/overdue invoices
    const { data: outstanding } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('club_id', clubId)
      .in('status', ['sent', 'overdue']);

    const outstandingRevenue = (outstanding || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.total_amount) || 0),
      0
    );

    return {
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      revenueGrowthRate: Math.round(revenueGrowthRate * 10) / 10,
      paidRevenueThisMonth: Math.round(monthlyRevenue * 100) / 100,
      outstandingRevenue: Math.round(outstandingRevenue * 100) / 100,
    };
  }

  private async getFeedbackMetrics(supabase: SupabaseClient, clubId: string) {
    const { count: totalFeedback } = await supabase
      .from('trainer_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    const { data: visibleFeedback } = await supabase
      .from('trainer_feedback')
      .select('rating')
      .eq('club_id', clubId)
      .eq('is_visible', true);

    const avgRating = visibleFeedback?.length
      ? visibleFeedback.reduce((sum: number, f: { rating: number }) => sum + f.rating, 0) / visibleFeedback.length
      : 0;

    // Response rate would require session tracking
    const feedbackResponseRate = 0; // Placeholder

    return {
      totalFeedback: totalFeedback || 0,
      avgFeedbackRating: Math.round(avgRating * 10) / 10,
      feedbackResponseRate,
    };
  }

  private async getMonthlyTrends(supabase: SupabaseClient, clubId: string) {
    const months = [];
    const now = new Date();

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const [{ count: members }, { count: sessions }, { count: bookings }, { data: invoices }] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .eq('role', 'member')
          .lte('created_at', monthEnd.toISOString()),
        supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .gte('date', monthStart.toISOString())
          .lte('date', monthEnd.toISOString()),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        supabase
          .from('invoices')
          .select('paid_amount')
          .eq('club_id', clubId)
          .eq('status', 'paid')
          .gte('paid_at', monthStart.toISOString())
          .lte('paid_at', monthEnd.toISOString()),
      ]);

      const monthRevenue = (invoices || []).reduce(
        (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.paid_amount) || 0),
        0
      );

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        members: members || 0,
        sessions: sessions || 0,
        bookings: bookings || 0,
        revenue: Math.round(monthRevenue * 100) / 100,
      });
    }

    return months;
  }
}

export const analyticsService = new AnalyticsService();
