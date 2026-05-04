import type { ClubId } from '@/domain/value-objects';
import { BookingId } from '@/domain/value-objects';
import type { Booking } from '@/domain/entities/booking';
import type { BookingRepository } from '@/domain/repositories';
import type { ScheduleRepository } from '@/domain/repositories';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { EmailService } from '@/infrastructure/email/email.service';
import { createClient } from '@/infrastructure/external/supabase/server';

export class UpdateBookingStatusUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private scheduleRepository: ScheduleRepository
  ) {}

  async execute(
    bookingId: string,
    status: 'confirmed' | 'cancelled' | 'no_show',
    actorClubIds: string[],
    isAdmin: boolean,
    actorId: string // Added for audit logging
  ): Promise<void> {
    const id = BookingId.fromString(bookingId);

    // Fetch booking
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Fetch session details to get club_id
    const sessionDetails = await this.scheduleRepository.getSessionDetails(booking.getSessionId());
    if (!sessionDetails) {
      throw new Error('Session not found');
    }

    const sessionClubId = sessionDetails.clubId.getValue();

    // Authorization: Admin can do anything; Trainer only in own club
    if (!isAdmin && !actorClubIds.includes(sessionClubId)) {
      throw new Error('Forbidden: no permission for this club');
    }

    // Get current status
    const currentStatus = booking.getStatus();

    // Transition validation: check if change is allowed
    if (currentStatus === status) {
      throw new Error(`Already ${status}`);
    }

    const allowedTransitions: Record<string, Array<'confirmed' | 'cancelled' | 'no_show'>> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['no_show'],
    };

    const allowedNext = allowedTransitions[currentStatus as 'pending' | 'confirmed'];
    if (!allowedNext || !allowedNext.includes(status)) {
      throw new Error(`Cannot change status from ${currentStatus} to ${status}`);
    }

    // Update
    await this.bookingRepository.updateStatus(id, status);

    // Audit log
    await AuditService.logBookingStatusChanged(actorId, bookingId, currentStatus, status);

    // Send email notification (fire and forget)
    this.sendStatusChangeEmail(booking, sessionDetails, status).catch(console.error);
  }

  private async sendStatusChangeEmail(
    booking: Booking,
    sessionDetails: { clubId: ClubId; timeslot: { getStart: () => Date; getEnd: () => Date } },
    newStatus: 'confirmed' | 'cancelled' | 'no_show'
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', booking.getMemberId().getValue())
        .single();

      const memberEmail = userData?.email;
      if (!memberEmail) {
        console.warn('No email found for member:', booking.getMemberId().getValue());
        return;
      }

      const memberName = userData.full_name || 'Mitglied';

      // Fetch club name
      const { data: clubData } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', sessionDetails.clubId.getValue())
        .single();

      const start = sessionDetails.timeslot.getStart();
      const end = sessionDetails.timeslot.getEnd();

      await EmailService.sendBookingStatusChanged(memberEmail, {
        memberName,
        newStatus,
        sessionStart: start,
        sessionEnd: end,
        clubName: clubData?.name,
      });
    } catch (error) {
      console.warn('Failed to send status change email:', error);
    }
  }
}
