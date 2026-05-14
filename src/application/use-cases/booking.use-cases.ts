import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { Booking } from '@/domain/entities/booking';
import type { CancellationReason } from '@/domain/entities/booking';
import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';
import type { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import type { MemberRepository } from '@/domain/repositories/member-repository.interface';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import type { CourtRepository } from '@/domain/repositories/court-repository.interface';
import type { ClubId, ScheduleId } from '@/domain/value-objects';
import { MemberId, SessionId, BookingId } from '@/domain/value-objects';
import { ValidationService } from '@/domain/services/validation.service';
import { BookingNotFoundError, SessionNotFoundError, DoubleBookingError } from '@/domain/errors';
import type { IEmailService, IAuditService } from '@/domain/services';
import { TOKENS } from '@/application/container';

export interface CreateBookingInput {
  memberId: string;
  sessionId: string;
  actorId?: string; // Optional: for audit logging
}

export interface CreateBookingOutput {
  bookingId: string;
  status: string;
}

@injectable()
export class CreateBookingUseCase {
  constructor(
    @inject(TOKENS.BookingRepository) private bookingRepository: BookingRepository,
    @inject(TOKENS.ScheduleRepository) private scheduleRepository: ScheduleRepository,
    @inject(TOKENS.MemberRepository) private memberRepository: MemberRepository,
    @inject(TOKENS.ClubRepository) private clubRepository: ClubRepository,
    @inject(TOKENS.EmailService) private emailService: IEmailService,
    @inject(TOKENS.AuditService) private auditService: IAuditService
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingOutput> {
    const memberId = MemberId.fromString(input.memberId);
    const sessionId = SessionId.fromString(input.sessionId);
    const actorId = input.actorId || memberId.getValue(); // fallback to memberId

    const sessionDetails = await this.scheduleRepository.getSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new SessionNotFoundError(input.sessionId);
    }

    // Prüfe auf Doppelbuchung
    const alreadyBooked = await this.bookingRepository.existsByMemberAndSession(
      memberId,
      sessionId
    );
    if (alreadyBooked) {
      throw new DoubleBookingError(memberId.getValue(), sessionId.getValue());
    }

    ValidationService.validateBooking(memberId.getValue(), sessionId.getValue(), new Date());

    const booking = Booking.create(
      sessionDetails.clubId,
      memberId,
      sessionDetails.scheduleId,
      sessionId,
      sessionDetails.timeslot.getStart() // Session start time for cancellation policy
    );

    await this.bookingRepository.save(booking);

    // Audit log
    await this.auditService.log({
      userId: actorId,
      action: 'create',
      entityType: 'booking',
      entityId: booking.getId().getValue(),
      details: {
        memberId: memberId.getValue(),
        sessionId: sessionId.getValue(),
      },
    });

    // Send confirmation email (fire and forget)
    this.sendConfirmationEmail(booking, sessionDetails).catch(console.error);

    return {
      bookingId: booking.getId().getValue(),
      status: booking.getStatus(),
    };
  }

  private async sendConfirmationEmail(
    booking: Booking,
    sessionDetails: {
      clubId: ClubId;
      timeslot: import('@/domain/value-objects').TimeSlot;
      maxParticipants: number;
    }
  ): Promise<void> {
    try {
      const memberData = await this.memberRepository.getMemberEmailAndName(booking.getMemberId());
      if (!memberData) {
        console.warn('No member data found for:', booking.getMemberId().getValue());
        return;
      }

      const club = await this.clubRepository.findById(sessionDetails.clubId);
      const clubName = club?.getName() || 'Verein';

      await this.emailService.sendBookingConfirmation(memberData.email, {
        memberName: memberData.name,
        sessionDate: sessionDetails.timeslot.getStart().toISOString().split('T')[0],
        sessionTime: sessionDetails.timeslot.getStart().toTimeString().slice(0, 5),
        courtName: 'Platz',
        clubName,
      });
    } catch (error) {
      console.warn('Failed to send confirmation email:', error);
    }
  }
}

export interface CancelBookingInput {
  bookingId: string;
  reason: CancellationReason;
  notes?: string | null | undefined;
  actorId?: string; // Optional: for audit logging
}

export interface CancelBookingOutput {
  success: boolean;
}

@injectable()
export class CancelBookingUseCase {
  constructor(
    @inject(TOKENS.BookingRepository) private bookingRepository: BookingRepository,
    @inject(TOKENS.ScheduleRepository) private scheduleRepository: ScheduleRepository,
    @inject(TOKENS.MemberRepository) private memberRepository: MemberRepository,
    @inject(TOKENS.ClubRepository) private clubRepository: ClubRepository,
    @inject(TOKENS.EmailService) private emailService: IEmailService,
    @inject(TOKENS.AuditService) private auditService: IAuditService
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const booking = await this.bookingRepository.findById(BookingId.fromString(input.bookingId));
    if (!booking) {
      throw new BookingNotFoundError(input.bookingId);
    }

    // Get session details for email
    const sessionDetails = await this.scheduleRepository.getSessionDetails(booking.getSessionId());
    if (!sessionDetails) {
      throw new Error('Session not found for booking');
    }

    const notes = input.notes === null ? undefined : input.notes;
    booking.cancel(input.reason, notes);
    await this.bookingRepository.save(booking);

    // Audit log via interface
    await this.auditService.log({
      userId: input.actorId || booking.getMemberId().getValue(),
      action: 'cancel',
      entityType: 'booking',
      entityId: input.bookingId,
      details: {
        reason: input.reason,
        notes,
      },
    });

    // Send cancellation email (async, don't block response)
    this.sendCancellationEmail(booking, sessionDetails, input).catch(console.error);

    return { success: true };
  }

  private async sendCancellationEmail(
    booking: Booking,
    sessionDetails: {
      clubId: ClubId;
      scheduleId: ScheduleId;
      timeslot: import('@/domain/value-objects').TimeSlot;
      maxParticipants: number;
    },
    input: CancelBookingInput
  ): Promise<void> {
    try {
      const memberData = await this.memberRepository.getMemberEmailAndName(booking.getMemberId());

      if (!memberData) {
        console.warn('No email found for member:', booking.getMemberId().getValue());
        return;
      }

      const sessionStart = sessionDetails.timeslot.getStart();
      const sessionDate = sessionStart.toISOString().split('T')[0];
      const sessionTime = sessionStart.toTimeString().slice(0, 5);

      await this.emailService.sendBookingCancellation(memberData.email, {
        memberName: memberData.name,
        sessionDate,
        sessionTime,
        courtName: '',
        reason: input.reason || undefined,
      });
    } catch (error) {
      console.warn('Failed to send cancellation email:', error);
    }
  }
}

export interface GetMemberBookingsInput {
  memberId: string;
}

export interface GetMemberBookingsOutput {
  bookings: Array<{
    id: string;
    sessionId: string;
    status: string;
    bookedAt: Date;
  }>;
}

@injectable()
export class GetMemberBookingsUseCase {
  constructor(@inject(TOKENS.BookingRepository) private bookingRepository: BookingRepository) {}

  async execute(input: GetMemberBookingsInput): Promise<GetMemberBookingsOutput> {
    const memberId = MemberId.fromString(input.memberId);
    const bookings = await this.bookingRepository.findByMember(memberId);
    return {
      bookings: bookings.map((b: Booking) => ({
        id: b.getId().getValue(),
        sessionId: b.getSessionId().getValue(),
        status: b.getStatus(),
        bookedAt: b.getBookedAt(),
      })),
    };
  }
}
