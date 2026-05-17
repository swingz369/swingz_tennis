export interface Statistics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  memberStats: MemberStatistics;
  revenueStats: RevenueStatistics;
  courtStats: CourtStatistics;
  trainerStats: TrainerStatistics;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberStatistics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  trialMembers: number;
  newMembers: number;
  convertedTrials: number;
  conversionRate: number;
  averageMembershipDuration: number;
  membersByStatus: Record<string, number>;
  membersByMembershipType: Record<string, number>;
}

export interface RevenueStatistics {
  totalRevenue: number;
  membershipRevenue: number;
  trainingRevenue: number;
  courtRevenue: number;
  otherRevenue: number;
  averageRevenuePerMember: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  revenueByCategory: Record<string, number>;
  pendingPayments: number;
  overduePayments: number;
}

export interface CourtStatistics {
  totalCourts: number;
  totalBookings: number;
  utilizationRate: number;
  averageDailyBookings: number;
  peakHours: Array<{
    hour: number;
    bookings: number;
  }>;
  bookingsByCourt: Record<string, number>;
  bookingsByDay: Record<string, number>;
  cancelledBookings: number;
  noShowRate: number;
}

export interface TrainerStatistics {
  totalTrainers: number;
  activeTrainers: number;
  totalHours: number;
  averageHoursPerTrainer: number;
  totalSessions: number;
  averageSessionsPerTrainer: number;
  hoursByTrainer: Record<string, number>;
  sessionsByTrainer: Record<string, number>;
  trainerEarnings: Record<string, number>;
  topPerformers: Array<{
    trainerId: string;
    hours: number;
    sessions: number;
    earnings: number;
  }>;
}

export interface Report {
  id: string;
  name: string;
  type: 'members' | 'revenue' | 'courts' | 'trainers' | 'custom';
  format: 'pdf' | 'excel' | 'csv';
  filters: ReportFilters;
  data: Record<string, unknown>;
  generatedAt: Date;
  generatedBy: string;
  fileUrl?: string;
  status: 'generating' | 'completed' | 'failed';
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  memberStatus?: string[];
  membershipType?: string[];
  trainerId?: string[];
  courtId?: string[];
  includeInactive?: boolean;
}

export interface DashboardMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  unit: string;
  trend: Array<{
    date: string;
    value: number;
  }>;
}
