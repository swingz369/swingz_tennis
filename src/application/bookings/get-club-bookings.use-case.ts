import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import type { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import { ClubId } from '@/domain/value-objects';
import type { BookingStatus } from '@/domain/entities/booking';

export interface ClubBooking {
  id: string;
  memberName: string;
  memberEmail: string;
  courtName: string;
  date: string;
  time: string;
  duration: number;
  status: BookingStatus;
}

export class GetClubBookingsUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private clubRepository: ClubRepository,
    private scheduleRepository: ScheduleRepository
  ) {}

  async execute(clubId: string): Promise<ClubBooking[]> {
    const club = await this.clubRepository.findById(ClubId.fromString(clubId));
    if (!club) {
      throw new Error('Club not found');
    }

    const bookings = await this.bookingRepository.findByClub(ClubId.fromString(clubId));

    // Fetch sessions to get timeslots and court info
    const sessions = await this.scheduleRepository.findSessionsByClubId(ClubId.fromString(clubId));
    const sessionMap = new Map<
      string,
      { timeslotStart: Date; timeslotEnd: Date; duration: number; courtId?: string }
    >();
    sessions.forEach((s) => {
      const entry: { timeslotStart: Date; timeslotEnd: Date; duration: number; courtId?: string } =
        {
          timeslotStart: s.timeslot.getStart(),
          timeslotEnd: s.timeslot.getEnd(),
          duration: s.timeslot.getDurationMinutes(),
        };
      if (s.courtId) entry.courtId = s.courtId;
      sessionMap.set(s.id, entry);
    });

    return bookings.map((b) => {
      const sessionInfo = sessionMap.get(b.getSessionId().getValue());
      return {
        id: b.getId().getValue(),
        memberName: b.getMemberId().getValue(),
        memberEmail: '',
        courtName: sessionInfo?.courtId || 'TBD',
        date: sessionInfo?.timeslotStart.toISOString().split('T')[0] || '',
        time: sessionInfo?.timeslotStart.toTimeString().slice(0, 5) || '',
        duration: sessionInfo?.duration || 0,
        status: b.getStatus(),
      };
    });
  }
}

export function getClubBookingsUseCase(
  bookingRepository: BookingRepository,
  clubRepository: ClubRepository,
  scheduleRepository: ScheduleRepository
) {
  return new GetClubBookingsUseCase(bookingRepository, clubRepository, scheduleRepository);
}
