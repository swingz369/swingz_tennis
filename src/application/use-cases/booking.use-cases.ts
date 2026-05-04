import { Booking } from '@/domain/entities/booking';
import type { CancellationReason } from '@/domain/entities/booking';
import { BookingRepository } from '@/domain/repositories/booking-repository.interface';
import { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import { MemberId, SessionId, BookingId, ClubId } from '@/domain/value-objects';
import { ValidationService } from '@/domain/services/validation.service';
import { BookingNotFoundError, SessionNotFoundError, DoubleBookingError } from '@/domain/errors';
import { IEmailService, IAuditService } from '@/domain/services';

export interface CreateBookingInput {
  memberId: string;
  sessionId: string;
  actorId?: string; // Optional: for audit logging
}

export interface CreateBookingOutput {
  bookingId: string;
  status: string;
}

export class CreateBookingUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private scheduleRepository: ScheduleRepository,
    private emailService: IEmailService,
    private auditService: IAuditService
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
      sessionId
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
      // Note: In a proper implementation, member and club data should be
      // passed as parameters or retrieved through repositories
      await this.emailService.sendBookingConfirmation('member@example.com', {
        memberName: 'Member',
        sessionDate: sessionDetails.timeslot.getStart().toISOString().split('T')[0],
        sessionTime: sessionDetails.timeslot.getStart().toTimeString().slice(0, 5),
        courtName: 'Court',
        clubName: 'Club',
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

export class CancelBookingUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private auditService: IAuditService
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const booking = await this.bookingRepository.findById(BookingId.fromString(input.bookingId));
    if (!booking) {
      throw new BookingNotFoundError(input.bookingId);
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
    this.sendCancellationEmail(booking, input).catch(console.error);

    return { success: true };
  }

  private async sendCancellationEmail(booking: Booking, input: CancelBookingInput): Promise<void> {
    try {
      const memberDataService = new SupabaseMemberDataService();
      const memberData = await memberDataService.getMemberEmailAndName(
        booking.getMemberId().getValue()
      );

      if (!memberData) {
        console.warn('No email found for member:', booking.getMemberId().getValue());
        return;
      }

      const formattedDate = booking.getBookedAt().toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const { EmailService } = await import('@/infrastructure/email/email.service');
      await EmailService.sendBookingCancellation(memberData.email, {
        memberName: memberData.name,
        reason: input.reason,
        sessionStartFormatted: formattedDate,
        ...(input.notes !== null && input.notes !== undefined ? { notes: input.notes } : {}),
      });
    } catch (error) {
      console.warn('Failed to send cancellation email:', error);
    }
  }
}

interface IMemberDataService {
  getMemberEmailAndName(memberId: string): Promise<{ email: string; name: string } | null>;
}

class SupabaseMemberDataService implements IMemberDataService {
  async getMemberEmailAndName(memberId: string) {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', memberId)
      .single();

    if (!userData?.email) return null;
    return {
      email: userData.email,
      name: userData.full_name || 'Mitglied',
    };
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

export class GetMemberBookingsUseCase {
  constructor(private bookingRepository: BookingRepository) {}

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
