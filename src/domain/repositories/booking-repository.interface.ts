import type { Booking } from '../entities/booking';
import type { BookingId, ClubId, MemberId, ScheduleId, SessionId } from '../value-objects';

export interface BookingRepository {
  findById(id: BookingId): Promise<Booking | null>;
  findByMember(memberId: MemberId): Promise<Booking[]>;
  findBySession(sessionId: SessionId): Promise<Booking[]>;
  findBySchedule(scheduleId: ScheduleId): Promise<Booking[]>;
  findByClub(clubId: ClubId): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  delete(id: BookingId): Promise<void>;
  countActiveBookingsForMember(memberId: MemberId): Promise<number>;
  exists(id: BookingId): Promise<boolean>;
  existsByMemberAndSession(memberId: MemberId, sessionId: SessionId): Promise<boolean>;

  // Analytics
  countByClubAndDateRange(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<{ total: number; confirmed: number; cancelled: number; noShow: number }>;

  // Update booking status (confirmed, cancelled, no_show)
  updateStatus(id: BookingId, status: 'confirmed' | 'cancelled' | 'no_show'): Promise<void>;
}
