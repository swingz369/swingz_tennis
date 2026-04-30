import { eq, and, sql, gte, lt } from 'drizzle-orm';
import { db } from '../client';
import { bookings } from '../schema';
import { Booking } from '@/domain/entities/booking';
import type { CancellationReason } from '@/domain/entities/booking';
import { BookingId, ClubId, MemberId, ScheduleId, SessionId } from '@/domain/value-objects';
import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';

export class DrizzleBookingRepository implements BookingRepository {
  async findById(id: BookingId): Promise<Booking | null> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id.getValue())).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByMember(memberId: MemberId): Promise<Booking[]> {
    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.member_id, memberId.getValue()));
    return result.map((row) => this.mapToDomain(row));
  }

  async findBySession(sessionId: SessionId): Promise<Booking[]> {
    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.session_id, sessionId.getValue()));
    return result.map((row) => this.mapToDomain(row));
  }

  async findBySchedule(scheduleId: ScheduleId): Promise<Booking[]> {
    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.schedule_id, scheduleId.getValue()));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByClub(clubId: ClubId): Promise<Booking[]> {
    const result = await db.select().from(bookings).where(eq(bookings.club_id, clubId.getValue()));
    return result.map((row) => this.mapToDomain(row));
  }

  async save(booking: Booking): Promise<void> {
    const now = new Date();
    const values = {
      id: booking.getId().getValue(),
      club_id: booking.getClubId().getValue(),
      member_id: booking.getMemberId().getValue(),
      schedule_id: booking.getScheduleId().getValue(),
      session_id: booking.getSessionId().getValue(),
      status: booking.getStatus(),
      booked_at: booking.getBookedAt() ?? now,
      cancelled_at: booking.getCancelledAt() ?? null,
      cancellation_reason: booking.getCancellationReason() ?? null,
      cancellation_notes: booking.getCancellationNotes() ?? null,
    };

    const existing = await this.findById(booking.getId());
    if (existing) {
      await db.update(bookings).set(values).where(eq(bookings.id, booking.getId().getValue()));
    } else {
      await db.insert(bookings).values(values);
    }
  }

  async delete(id: BookingId): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id.getValue()));
  }

  async countActiveBookingsForMember(memberId: MemberId): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(eq(bookings.member_id, memberId.getValue()), eq(bookings.status, 'confirmed')));
    return Number(result[0]?.count) || 0;
  }

  async countByClubAndDateRange(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<{ total: number; confirmed: number; cancelled: number; noShow: number }> {
    // Build count queries with conditional filters
    const baseWhere = and(
      eq(bookings.club_id, clubId.getValue()),
      gte(bookings.booked_at, startDate),
      lt(bookings.booked_at, endDate)
    );

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(baseWhere);
    const confirmedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(baseWhere, eq(bookings.status, 'confirmed')));
    const cancelledResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(baseWhere, eq(bookings.status, 'cancelled')));
    const noShowResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(baseWhere, eq(bookings.status, 'no_show')));

    return {
      total: Number(totalResult[0]?.count) || 0,
      confirmed: Number(confirmedResult[0]?.count) || 0,
      cancelled: Number(cancelledResult[0]?.count) || 0,
      noShow: Number(noShowResult[0]?.count) || 0,
    };
  }

  async exists(id: BookingId): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.id, id.getValue()));
    return result[0]?.count > 0;
  }

  async existsByMemberAndSession(memberId: MemberId, sessionId: SessionId): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.member_id, memberId.getValue()),
          eq(bookings.session_id, sessionId.getValue())
        )
      );
    return result[0]?.count > 0;
  }

  async updateStatus(id: BookingId, status: 'confirmed' | 'cancelled' | 'no_show'): Promise<void> {
    await db.update(bookings).set({ status }).where(eq(bookings.id, id.getValue()));
  }

  private mapToDomain(row: typeof bookings.$inferSelect): Booking {
    return Booking.reconstitute(
      BookingId.fromString(row.id),
      ClubId.fromString(row.club_id),
      MemberId.fromString(row.member_id),
      ScheduleId.fromString(row.schedule_id),
      SessionId.fromString(row.session_id),
      row.status as Booking['status'],
      new Date(row.booked_at),
      row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      row.cancellation_reason as CancellationReason | undefined,
      row.cancellation_notes || undefined
    );
  }
}
