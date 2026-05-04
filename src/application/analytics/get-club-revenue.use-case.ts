import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import type { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import { ClubId } from '@/domain/value-objects';

export interface RevenueData {
  totalRevenue: number;
  payments: Array<{
    id: string;
    memberId: string;
    memberName: string;
    amount: number;
    date: string;
    time: string;
    method: 'credit_card' | 'debit' | 'cash' | 'bank_transfer';
    status: 'paid' | 'pending' | 'failed';
  }>;
  monthlyBreakdown: Array<{ month: string; revenue: number }>;
}

export class GetClubRevenueUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private clubRepository: ClubRepository,
    private scheduleRepository: ScheduleRepository
  ) {}

  async execute(clubId: string): Promise<RevenueData> {
    const club = await this.clubRepository.findById(ClubId.fromString(clubId));
    if (!club) {
      throw new Error('Club not found');
    }

    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // Fetch all bookings for the club
    const bookings = await this.bookingRepository.findByClub(ClubId.fromString(clubId));

    // Fetch all sessions for the club to get timeslots
    const sessions = await this.scheduleRepository.findSessionsByClubId(ClubId.fromString(clubId));
    const sessionMap = new Map<string, { start: Date; end: Date }>();
    sessions.forEach((s) => {
      sessionMap.set(s.id, {
        start: s.timeslot.getStart(),
        end: s.timeslot.getEnd(),
      });
    });

    // Filter to confirmed bookings within date range
    const relevantBookings = bookings.filter((b) => {
      const sessionInfo = sessionMap.get(b.getSessionId().getValue());
      if (!sessionInfo) return false;
      const sessionDate = sessionInfo.start;
      return sessionDate >= sixMonthsAgo && sessionDate <= now && b.getStatus() === 'confirmed';
    });

    const pricePerBooking = 15;
    const totalRevenue = relevantBookings.length * pricePerBooking;

    // Build payments with member info and time
    const payments = await Promise.all(
      relevantBookings.map(async (b, idx) => {
        const sessionInfo = sessionMap.get(b.getSessionId().getValue())!;
        const dateStr = sessionInfo.start.toISOString().split('T')[0];
        const timeStr = sessionInfo.start.toTimeString().slice(0, 5);
        const method = ['credit_card', 'debit', 'cash', 'bank_transfer'][
          Math.floor(Math.random() * 4)
        ] as 'credit_card' | 'debit' | 'cash' | 'bank_transfer';

        return {
          id: `pay-${b.getId().getValue()}`,
          memberId: b.getMemberId().getValue(),
          memberName: `Member ${idx + 1}`,
          amount: pricePerBooking,
          date: dateStr,
          time: timeStr,
          method,
          status: 'paid' as const,
        };
      })
    );

    // Monthly breakdown
    const monthlyMap = new Map<string, number>();
    payments.forEach((p) => {
      const month = p.date.substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + p.amount);
    });

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({ month, revenue }));

    return {
      totalRevenue,
      payments,
      monthlyBreakdown,
    };
  }
}

export function getClubRevenueUseCase(
  bookingRepository: BookingRepository,
  clubRepository: ClubRepository,
  scheduleRepository: ScheduleRepository
) {
  return new GetClubRevenueUseCase(bookingRepository, clubRepository, scheduleRepository);
}
