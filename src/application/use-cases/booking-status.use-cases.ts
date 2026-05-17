import type { ClubId } from '@/domain/value-objects';
import { BookingId } from '@/domain/value-objects';
import type { Booking } from '@/domain/entities/booking';
import type { BookingRepository } from '@/domain/repositories';
import type { ScheduleRepository } from '@/domain/repositories';
import type { IAuditService } from '@/domain/services/audit.service.interface';
import type { IEmailService, EmailTemplate } from '@/domain/services/email.service.interface';
import { createClient } from '@/infrastructure/external/supabase/server';

export class UpdateBookingStatusUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private scheduleRepository: ScheduleRepository,
    private auditService: IAuditService,
    private emailService: IEmailService
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

    // Audit log using injected IAuditService
    await this.auditService.log({
      userId: actorId,
      action: 'update',
      entityType: 'booking',
      entityId: bookingId,
      details: { oldStatus: currentStatus, newStatus: status },
    });

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
      const clubName = clubData?.name;

      const statusLabels: Record<string, string> = {
        confirmed: 'bestätigt',
        cancelled: 'storniert',
        no_show: 'als nicht erschienen markiert',
      };
      const statusLabel = statusLabels[newStatus] || newStatus;

      const formatDate = (d: Date) =>
        d.toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

      const template: EmailTemplate = {
        to: memberEmail,
        subject: `Buchungsstatus geändert: ${statusLabel}`,
        html: `
          <h1>Buchungsstatus geändert</h1>
          <p>Hallo ${memberName},</p>
          <p>Der Status deiner Buchung wurde zu <strong>${statusLabel}</strong> geändert.</p>
          <p><strong>Termin:</strong> ${formatDate(start)} - ${formatDate(end)}</p>
          ${clubName ? `<p><strong>Verein:</strong> ${clubName}</p>` : ''}
          <p>Bei Fragen wende dich bitte an deinen Trainer oder den Verein.</p>
        `,
        text: `Buchungsstatus geändert: ${statusLabel}\n\nHallo ${memberName},\n\nDer Status deiner Buchung wurde zu ${statusLabel} geändert.\n\nTermin: ${formatDate(start)} - ${formatDate(end)}\n${clubName ? `Verein: ${clubName}` : ''}`,
      };

      await this.emailService.sendEmail(template);
    } catch (error) {
      console.warn('Failed to send status change email:', error);
    }
  }
}
