import { createClient } from '@/infrastructure/external/supabase/server';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

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

  // Revenue metrics (placeholder for now)
  monthlyRevenue: number;
  revenueGrowthRate: number;

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
    const [membersData, trainersData, sessionsData, bookingsData, feedbackData, monthlyTrendData] =
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
        this.getMonthlyTrends(supabase, clubId),
      ]);

    return {
      ...membersData,
      ...trainersData,
      ...sessionsData,
      ...bookingsData,
      ...feedbackData,
      monthlyRevenue: 0, // Placeholder
      revenueGrowthRate: 0, // Placeholder
      monthlyData: monthlyTrendData,
    };
  }

  private async getMemberMetrics(
    supabase: any,
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
    supabase: any,
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
      ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
      : 0;

    return {
      totalTrainers: totalTrainers || 0,
      activeTrainersThisMonth: activeTrainersThisMonth || 0,
      avgTrainerRating: Math.round(avgRating * 10) / 10,
    };
  }

  private async getSessionMetrics(
    supabase: any,
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
      sessionBookings?.filter((b: any) => b.status === 'confirmed').length || 0;
    const completedSessions = sessionBookings?.length || 1;

    return {
      totalSessions: totalSessions || 0,
      sessionsThisMonth: sessionsThisMonth || 0,
      avgSessionAttendance: Math.round((confirmedBookings / completedSessions) * 10) / 10,
      sessionCompletionRate: Math.round((confirmedBookings / completedSessions) * 100 * 10) / 10,
    };
  }

  private async getBookingMetrics(
    supabase: any,
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

  private async getFeedbackMetrics(supabase: any, clubId: string) {
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
      ? visibleFeedback.reduce((sum: number, f: any) => sum + f.rating, 0) / visibleFeedback.length
      : 0;

    // Response rate would require session tracking
    const feedbackResponseRate = 0; // Placeholder

    return {
      totalFeedback: totalFeedback || 0,
      avgFeedbackRating: Math.round(avgRating * 10) / 10,
      feedbackResponseRate,
    };
  }

  private async getMonthlyTrends(supabase: any, clubId: string) {
    const months = [];
    const now = new Date();

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const [{ count: members }, { count: sessions }, { count: bookings }] = await Promise.all([
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
      ]);

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        members: members || 0,
        sessions: sessions || 0,
        bookings: bookings || 0,
        revenue: 0, // Placeholder
      });
    }

    return months;
  }
}

export const analyticsService = new AnalyticsService();
