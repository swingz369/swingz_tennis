/**
 * Email Service Interface (Domain Layer)
 *
 * Definiert die Contract für E-Mail-Versand ohne Infrastructure-Details
 * Pattern from INTEGRATION_ROADMAP.md Phase 2.2
 *
 * Use Cases können diese Interface verwenden, ohne von konkreten
 * E-Mail-Providern (Resend, SendGrid, etc.) abhängig zu sein
 */

import type { Booking } from '../entities/booking';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  /**
   * Send booking confirmation email to member
   */
  sendBookingConfirmation(booking: Booking, recipient: EmailRecipient): Promise<void>;

  /**
   * Send booking cancellation email
   */
  sendBookingCancellation(
    booking: Booking,
    recipient: EmailRecipient,
    reason: string
  ): Promise<void>;

  /**
   * Send session reminder email (24h before session)
   */
  sendSessionReminder(
    sessionId: string,
    recipients: EmailRecipient[],
    sessionDetails: {
      date: Date;
      time: string;
      court: string;
      trainer: string;
    }
  ): Promise<void>;

  /**
   * Send invoice email with PDF attachment
   */
  sendInvoice(
    invoiceId: string,
    recipient: EmailRecipient,
    invoiceDetails: {
      invoiceNumber: string;
      amount: number;
      dueDate: Date;
      items: Array<{ description: string; amount: number }>;
    }
  ): Promise<void>;

  /**
   * Send dunning notice (Mahnung)
   */
  sendDunningNotice(
    invoiceId: string,
    recipient: EmailRecipient,
    level: 1 | 2 | 3,
    dueDate: Date,
    amount: number
  ): Promise<void>;

  /**
   * Send welcome email to new member
   */
  sendWelcomeEmail(recipient: EmailRecipient, clubName: string): Promise<void>;

  /**
   * Send password reset email
   */
  sendPasswordReset(recipient: EmailRecipient, resetToken: string, expiresAt: Date): Promise<void>;

  /**
   * Send generic email with custom template
   */
  sendCustomEmail(recipient: EmailRecipient, template: EmailTemplate): Promise<void>;

  /**
   * Send bulk email to multiple recipients
   */
  sendBulkEmail(recipients: EmailRecipient[], template: EmailTemplate): Promise<void>;
}

/**
 * Usage in Use Case:
 *
 * ```ts
 * // src/application/use-cases/booking.use-cases.ts
 * import type { EmailService } from '@/domain/services/email-service.interface';
 * import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';
 *
 * export class CreateBookingUseCase {
 *   constructor(
 *     private readonly bookingRepo: BookingRepository,
 *     private readonly emailService: EmailService  // ← Interface, not implementation
 *   ) {}
 *
 *   async execute(input: CreateBookingInput): Promise<BookingOutput> {
 *     const booking = Booking.create({ ... });
 *     await this.bookingRepo.save(booking);
 *
 *     // Send email via interface
 *     await this.emailService.sendBookingConfirmation(booking, {
 *       email: input.memberEmail,
 *       name: input.memberName,
 *     });
 *
 *     return { id: booking.getId().getValue() };
 *   }
 * }
 * ```
 */
