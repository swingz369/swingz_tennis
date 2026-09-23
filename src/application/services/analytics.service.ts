import type { AuthContext } from '@/lib/api-auth';
import { getUserDb } from '@/infrastructure/db';
import { AnalyticsRepository } from '@/infrastructure/persistence/repositories/analytics.repository';
import { MemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import { ClubId } from '@/domain/value-objects';

export interface ClubBooking {
  id: string;
  memberName: string;
  memberEmail: string;
  courtName: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

export interface RevenueData {
  totalRevenue: number;
  payments: Array<{
    id: string;
    memberId: string;
    amount: number;
    date: string;
    time: string;
    method: string;
    status: 'paid';
  }>;
  monthlyBreakdown: Array<{ month: string; revenue: number }>;
}

export interface ClubMember {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  lastVisit?: string;
}

/**
 * Auswertungs-Service (ADR-005): Buchungs-/Umsatz-Export und Insights.
 * Ersetzt die drei use-case-Klassen; Datenzugriff über Repositories mit RLS.
 */
export class AnalyticsService {
  private readonly analytics: AnalyticsRepository;
  private readonly members: MemberRepository;

  constructor(auth: AuthContext) {
    const db = getUserDb(auth);
    this.analytics = new AnalyticsRepository(db);
    this.members = new MemberRepository(db);
  }

  async listBookings(clubId: string): Promise<ClubBooking[]> {
    const bookings = await this.analytics.findBookingsWithSession(clubId);
    return bookings.map((b) => ({
      id: b.id,
      memberName: b.memberId,
      memberEmail: '',
      courtName: b.session?.courtId || 'TBD',
      date: b.session?.start.toISOString().split('T')[0] || '',
      time: b.session?.start.toTimeString().slice(0, 5) || '',
      duration: b.session
        ? Math.round((b.session.end.getTime() - b.session.start.getTime()) / 60000)
        : 0,
      status: b.status,
    }));
  }

  async revenue(clubId: string): Promise<RevenueData> {
    const paid = await this.analytics.findPaidPayments(clubId);
    const payments = paid.map((p) => {
      const date = new Date(p.paidAt);
      return {
        id: p.id,
        memberId: p.memberId ?? '',
        amount: p.amount,
        date: date.toISOString().split('T')[0],
        time: date.toISOString().slice(11, 16),
        method: p.method,
        status: 'paid' as const,
      };
    });

    const monthly = new Map<string, number>();
    for (const p of payments) {
      const month = p.date.substring(0, 7);
      monthly.set(month, (monthly.get(month) || 0) + p.amount);
    }

    return {
      totalRevenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
      payments,
      monthlyBreakdown: [...monthly.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, revenue]) => ({ month, revenue })),
    };
  }

  async listMembers(clubId: string): Promise<ClubMember[]> {
    const members = await this.members.findByClub(ClubId.fromString(clubId));
    return members.map((m) => ({
      id: m.id.getValue(),
      name: m.name,
      email: m.email,
      joinDate: m.joinDate.toISOString().split('T')[0],
    }));
  }
}
