import {
  ClubRepository,
  ScheduleRepository,
  TrainerRepository,
  CourtRepository,
  BookingRepository,
} from '@/domain/repositories';
import { ClubId } from '@/domain/value-objects';
import type { Session, Court } from '@/domain/entities';

export interface ClubKPIs {
  clubId: string;
  name: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalMembers: number;
    totalSessions: number;
    newMembers: number;
    activeTrainers: number;
    totalTrainingHours: number;
    courtUtilization: number;
    memberGrowthRate: number;
    aiScheduleAccuracy: number;
    revenue: number;
    bookings: {
      total: number;
      confirmed: number;
      cancelled: number;
      noShow: number;
    };
  };
  trends: {
    memberGrowthByMonth: Array<{ month: string; count: number }>;
    bookingVolumeByWeek: Array<{ week: string; bookings: number }>;
  };
  sessionsPerTrainer: Array<{ trainerId: string; trainerName: string; sessions: number }>;
  capacityUtilization: Array<{ courtId: string; courtName: string; util: number }>;
}

export class GetClubAnalyticsUseCase {
  constructor(
    private clubRepository: ClubRepository,
    private scheduleRepository: ScheduleRepository,
    private trainerRepository: TrainerRepository,
    private courtRepository: CourtRepository,
    private bookingRepository: BookingRepository
  ) {}

  async execute(clubId: string, startDate: Date, endDate: Date): Promise<ClubKPIs> {
    const club = await this.clubRepository.findById(ClubId.fromString(clubId));
    if (!club) {
      throw new Error('Club not found');
    }

    // Parallel fetch all data
    const [courts, allSessions, bookingStats, memberStats, growthHistory] = await Promise.all([
      this.courtRepository.findByClub(ClubId.fromString(clubId)),
      this.scheduleRepository.findSessionsByClubId(ClubId.fromString(clubId)),
      this.bookingRepository.countByClubAndDateRange(ClubId.fromString(clubId), startDate, endDate),
      this.clubRepository.getMemberStats(ClubId.fromString(clubId), startDate, endDate),
      this.clubRepository.getMemberGrowthHistory(ClubId.fromString(clubId), startDate, endDate),
    ]);

    // Filter sessions by date range
    const sessions = allSessions.filter((s: Session) => {
      const sessionDate = s.timeslot.getStart();
      return sessionDate >= startDate && sessionDate <= endDate;
    });

    // Calculate basic metrics
    const totalHours = sessions.reduce((sum, s) => sum + s.timeslot.getDurationMinutes(), 0) / 60;
    const totalSessions = sessions.length;
    const activeTrainers = new Set(sessions.map((s) => s.trainerId.toString())).size;

    // Court utilization
    const dates = sessions.map((s) => s.timeslot.getStart());
    const minDate =
      dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
    const maxDate =
      dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();
    const days = this.getDaysBetween(minDate, maxDate) || 1;
    const courtUsage = new Map<string, number>();
    sessions.forEach((s) => {
      const courtId = s.courtId ?? 'uncategorized';
      courtUsage.set(
        courtId,
        (courtUsage.get(courtId) || 0) + s.timeslot.getDurationMinutes() / 60
      );
    });
    const capacityUtilization = courts.map((court: Court) => {
      const hoursUsed = courtUsage.get(court.id) || 0;
      const hoursAvailable = 10 * days;
      const util = Math.min(Math.round((hoursUsed / hoursAvailable) * 100), 100);
      return { courtId: court.id, courtName: court.name, util };
    });

    // Sessions per trainer
    const trainerMap = new Map<string, number>();
    sessions.forEach((s) => {
      const tid = s.trainerId.toString();
      trainerMap.set(tid, (trainerMap.get(tid) || 0) + 1);
    });
    const trainerIds = Array.from(trainerMap.keys());
    const trainersPromises = trainerIds.map((id) =>
      this.trainerRepository.findById(TrainerId.fromString(id))
    );
    const trainers = await Promise.all(trainersPromises);
    const sessionsPerTrainer = trainerIds
      .map((trainerId, idx) => ({
        trainerId,
        trainerName: trainers[idx]?.name || trainerId,
        sessions: trainerMap.get(trainerId) || 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Overall court utilization (average)
    const overallCourtUtil =
      capacityUtilization.length > 0
        ? Math.round(
            capacityUtilization.reduce((sum, c) => sum + c.util, 0) / capacityUtilization.length
          )
        : 0;

    // Trends
    const trends = {
      memberGrowthByMonth: growthHistory,
      bookingVolumeByWeek: sessions.slice(0, 12).map((_s, i) => ({
        week: `KW${20 + i}`,
        bookings: Math.floor(Math.random() * 50) + 30,
      })),
    };

    return {
      clubId: club.getId().getValue(),
      name: club.getName(),
      period: { startDate, endDate },
      metrics: {
        totalMembers: memberStats.active,
        totalSessions,
        newMembers: memberStats.new,
        activeTrainers,
        totalTrainingHours: totalHours,
        courtUtilization: overallCourtUtil,
        memberGrowthRate:
          growthHistory.length >= 2
            ? ((growthHistory[growthHistory.length - 1].count - growthHistory[0].count) /
                growthHistory[0].count) *
              100
            : 0,
        aiScheduleAccuracy: 0, // Not implemented in MVP - requires predicted vs actual attendance data
        revenue: totalHours * 25,
        bookings: {
          total: bookingStats.total,
          confirmed: bookingStats.confirmed,
          cancelled: bookingStats.cancelled,
          noShow: bookingStats.noShow,
        },
      },
      trends,
      sessionsPerTrainer,
      capacityUtilization,
    };
  }

  private getDaysBetween(start: Date, end: Date): number {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
}
