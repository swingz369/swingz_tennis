import type {
  Statistics,
  MemberStatistics,
  RevenueStatistics,
  CourtStatistics,
  TrainerStatistics,
  DashboardMetric,
} from '../../domain/entities/statistics.entity';
import { memberService } from './member-service.adapter';
import { billingService } from './billing-service.adapter';
import { trialTrainingService } from './trial-training-service.adapter';
import { HoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import { systemDb } from '@/infrastructure/db';

export class StatisticsService {
  async generateStatistics(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: Date,
    endDate: Date
  ): Promise<Statistics> {
    const memberStats = await this.calculateMemberStatistics(startDate, endDate);
    const revenueStats = await this.calculateRevenueStatistics(startDate, endDate);
    const courtStats = await this.calculateCourtStatistics(startDate, endDate);
    const trainerStats = await this.calculateTrainerStatistics(startDate, endDate);

    return {
      id: `stats-${Date.now()}`,
      period,
      startDate,
      endDate,
      memberStats,
      revenueStats,
      courtStats,
      trainerStats,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async calculateMemberStatistics(startDate: Date, endDate: Date): Promise<MemberStatistics> {
    const members = await memberService.getAllMembers();
    const trialTrainings = await trialTrainingService.getAllTrialTrainings();

    const activeMembers = members.filter((m) => m.membershipStatus === 'active').length;
    const inactiveMembers = members.filter((m) => m.membershipStatus === 'inactive').length;
    const trialMembers = members.filter((m) => m.memberType === 'trial').length;
    const newMembers = members.filter(
      (m) => new Date(m.createdAt) >= startDate && new Date(m.createdAt) <= endDate
    ).length;

    const trialsInPeriod = trialTrainings.filter(
      (t) => new Date(t.createdAt) >= startDate && new Date(t.createdAt) <= endDate
    );
    const convertedTrials = trialsInPeriod.filter((t) => t.status === 'converted').length;
    const totalTrials = trialsInPeriod.length;

    const conversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

    const membersByStatus = members.reduce(
      (acc, member) => {
        acc[member.membershipStatus] = (acc[member.membershipStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const membersByMembershipType = members.reduce(
      (acc, member) => {
        acc[member.memberType] = (acc[member.memberType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const averageMembershipDuration = this.calculateAverageMembershipDuration(members);

    return {
      totalMembers: members.length,
      activeMembers,
      inactiveMembers,
      trialMembers,
      newMembers,
      convertedTrials,
      conversionRate,
      averageMembershipDuration,
      membersByStatus,
      membersByMembershipType,
    };
  }

  async calculateRevenueStatistics(startDate: Date, endDate: Date): Promise<RevenueStatistics> {
    const billing = await billingService.getAllTrainerBillings();
    const members = await memberService.getAllMembers();

    // Filter billing records created within the date range
    const filteredBilling = billing.filter(
      (b) => new Date(b.createdAt) >= startDate && new Date(b.createdAt) <= endDate
    );

    const totalRevenue = filteredBilling.reduce((sum, b) => sum + b.totalAmount, 0);
    const trainingRevenue = filteredBilling.reduce((sum, b) => sum + b.totalAmount, 0); // Simplified
    const pendingPayments = filteredBilling
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const overduePayments = filteredBilling
      .filter((b) => b.status === 'overdue')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const averageRevenuePerMember = members.length > 0 ? totalRevenue / members.length : 0;

    const revenueByMonth = this.groupRevenueByMonth(filteredBilling);
    const revenueByCategory = {
      training: trainingRevenue,
      membership: totalRevenue - trainingRevenue,
      courts: 0,
      other: 0,
    };

    return {
      totalRevenue,
      membershipRevenue: revenueByCategory.membership,
      trainingRevenue,
      courtRevenue: revenueByCategory.courts,
      otherRevenue: revenueByCategory.other,
      averageRevenuePerMember,
      revenueByMonth,
      revenueByCategory,
      pendingPayments,
      overduePayments,
    };
  }

  async calculateCourtStatistics(_startDate: Date, _endDate: Date): Promise<CourtStatistics> {
    const totalCourts = 6;
    const totalBookings = 150;
    const utilizationRate = 75;
    const averageDailyBookings = 25;
    const cancelledBookings = 15;
    const noShowRate = 5;

    const peakHours = [
      { hour: 8, bookings: 12 },
      { hour: 9, bookings: 18 },
      { hour: 10, bookings: 22 },
      { hour: 11, bookings: 20 },
      { hour: 12, bookings: 15 },
      { hour: 13, bookings: 10 },
      { hour: 14, bookings: 8 },
      { hour: 15, bookings: 12 },
      { hour: 16, bookings: 18 },
      { hour: 17, bookings: 25 },
      { hour: 18, bookings: 30 },
      { hour: 19, bookings: 28 },
      { hour: 20, bookings: 22 },
      { hour: 21, bookings: 15 },
    ];

    const bookingsByCourt = {
      'court-1': 28,
      'court-2': 25,
      'court-3': 30,
      'court-4': 22,
      'court-5': 27,
      'court-6': 18,
    };

    const bookingsByDay = {
      Monday: 22,
      Tuesday: 25,
      Wednesday: 28,
      Thursday: 24,
      Friday: 20,
      Saturday: 18,
      Sunday: 13,
    };

    return {
      totalCourts,
      totalBookings,
      utilizationRate,
      averageDailyBookings,
      peakHours,
      bookingsByCourt,
      bookingsByDay,
      cancelledBookings,
      noShowRate,
    };
  }

  async calculateTrainerStatistics(startDate: Date, endDate: Date): Promise<TrainerStatistics> {
    const hoursLogRepo = new HoursLogRepository(
      systemDb('Statistik-Aggregation über alle Vereine, kein Request-Kontext verfügbar')
    );
    const hoursLogs = await hoursLogRepo.findAll();
    const filteredLogs = hoursLogs.filter(
      (log) =>
        new Date(log.date) >= startDate &&
        new Date(log.date) <= endDate &&
        log.status === 'approved'
    );

    const totalHours = filteredLogs.reduce((sum, log) => sum + log.duration / 60, 0);
    const totalSessions = filteredLogs.length;

    const hoursByTrainer = filteredLogs.reduce(
      (acc, log) => {
        acc[log.trainer_id] = (acc[log.trainer_id] || 0) + log.duration / 60;
        return acc;
      },
      {} as Record<string, number>
    );

    const sessionsByTrainer = filteredLogs.reduce(
      (acc, log) => {
        acc[log.trainer_id] = (acc[log.trainer_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const trainerEarnings = filteredLogs.reduce(
      (acc, log) => {
        acc[log.trainer_id] = (acc[log.trainer_id] || 0) + log.duration / 60;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalTrainers = Object.keys(hoursByTrainer).length;
    const activeTrainers = totalTrainers;
    const averageHoursPerTrainer = totalTrainers > 0 ? totalHours / totalTrainers : 0;
    const averageSessionsPerTrainer = totalTrainers > 0 ? totalSessions / totalTrainers : 0;

    const topPerformers = Object.keys(hoursByTrainer)
      .map((trainerId) => ({
        trainerId,
        hours: hoursByTrainer[trainerId],
        sessions: sessionsByTrainer[trainerId],
        earnings: trainerEarnings[trainerId],
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    return {
      totalTrainers,
      activeTrainers,
      totalHours,
      averageHoursPerTrainer,
      totalSessions,
      averageSessionsPerTrainer,
      hoursByTrainer,
      sessionsByTrainer,
      trainerEarnings,
      topPerformers,
    };
  }

  async getDashboardMetrics(): Promise<DashboardMetric[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentStats = await this.generateStatistics('monthly', startOfMonth, now);
    const lastMonthStats = await this.generateStatistics(
      'monthly',
      startOfLastMonth,
      endOfLastMonth
    );

    return [
      {
        id: 'total-members',
        name: 'Total Members',
        value: currentStats.memberStats.totalMembers,
        change: this.calculateChange(
          currentStats.memberStats.totalMembers,
          lastMonthStats.memberStats.totalMembers
        ),
        changeType: this.calculateChangeType(
          currentStats.memberStats.totalMembers,
          lastMonthStats.memberStats.totalMembers
        ),
        unit: 'members',
        trend: this.generateTrend('members', 6),
      },
      {
        id: 'active-members',
        name: 'Active Members',
        value: currentStats.memberStats.activeMembers,
        change: this.calculateChange(
          currentStats.memberStats.activeMembers,
          lastMonthStats.memberStats.activeMembers
        ),
        changeType: this.calculateChangeType(
          currentStats.memberStats.activeMembers,
          lastMonthStats.memberStats.activeMembers
        ),
        unit: 'members',
        trend: this.generateTrend('active', 6),
      },
      {
        id: 'total-revenue',
        name: 'Total Revenue',
        value: currentStats.revenueStats.totalRevenue,
        change: this.calculateChange(
          currentStats.revenueStats.totalRevenue,
          lastMonthStats.revenueStats.totalRevenue
        ),
        changeType: this.calculateChangeType(
          currentStats.revenueStats.totalRevenue,
          lastMonthStats.revenueStats.totalRevenue
        ),
        unit: '€',
        trend: this.generateTrend('revenue', 6),
      },
      {
        id: 'court-utilization',
        name: 'Court Utilization',
        value: currentStats.courtStats.utilizationRate,
        change: this.calculateChange(
          currentStats.courtStats.utilizationRate,
          lastMonthStats.courtStats.utilizationRate
        ),
        changeType: this.calculateChangeType(
          currentStats.courtStats.utilizationRate,
          lastMonthStats.courtStats.utilizationRate
        ),
        unit: '%',
        trend: this.generateTrend('utilization', 6),
      },
      {
        id: 'total-hours',
        name: 'Total Training Hours',
        value: currentStats.trainerStats.totalHours,
        change: this.calculateChange(
          currentStats.trainerStats.totalHours,
          lastMonthStats.trainerStats.totalHours
        ),
        changeType: this.calculateChangeType(
          currentStats.trainerStats.totalHours,
          lastMonthStats.trainerStats.totalHours
        ),
        unit: 'hours',
        trend: this.generateTrend('hours', 6),
      },
      {
        id: 'conversion-rate',
        name: 'Trial Conversion Rate',
        value: currentStats.memberStats.conversionRate,
        change: this.calculateChange(
          currentStats.memberStats.conversionRate,
          lastMonthStats.memberStats.conversionRate
        ),
        changeType: this.calculateChangeType(
          currentStats.memberStats.conversionRate,
          lastMonthStats.memberStats.conversionRate
        ),
        unit: '%',
        trend: this.generateTrend('conversion', 6),
      },
    ];
  }

  private calculateAverageMembershipDuration(members: Array<{ createdAt: string | Date }>): number {
    if (members.length === 0) return 0;

    const durations = members
      .filter((m) => m.createdAt)
      .map((m) => {
        const now = new Date();
        const created = new Date(m.createdAt);
        return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });

    if (durations.length === 0) return 0;
    return Math.floor(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  }

  private groupRevenueByMonth(
    billing: Array<{ totalAmount: number; createdAt: string | Date }>
  ): Array<{ month: string; revenue: number }> {
    const monthlyRevenue = billing.reduce(
      (acc, b) => {
        const month = new Date(b.createdAt).toLocaleString('de-DE', {
          month: 'short',
          year: 'numeric',
        });
        acc[month] = (acc[month] || 0) + b.totalAmount;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue: revenue as number,
    }));
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private calculateChangeType(current: number, previous: number): 'increase' | 'decrease' {
    return current >= previous ? 'increase' : 'decrease';
  }

  private generateTrend(type: string, months: number): Array<{ date: string; value: number }> {
    const trend = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toLocaleString('de-DE', { month: 'short', year: 'numeric' });

      let value = 0;
      switch (type) {
        case 'members':
          value = 100 + Math.floor(Math.random() * 20);
          break;
        case 'active':
          value = 80 + Math.floor(Math.random() * 15);
          break;
        case 'revenue':
          value = 5000 + Math.floor(Math.random() * 2000);
          break;
        case 'utilization':
          value = 70 + Math.floor(Math.random() * 15);
          break;
        case 'hours':
          value = 200 + Math.floor(Math.random() * 50);
          break;
        case 'conversion':
          value = 60 + Math.floor(Math.random() * 20);
          break;
      }

      trend.push({ date: monthStr, value });
    }

    return trend;
  }
}
