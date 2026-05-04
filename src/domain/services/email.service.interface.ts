/**
 * Email Service Interface
 * Domain layer interface for email sending functionality
 */

export interface EmailTemplate {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface BookingConfirmationData {
  memberName: string;
  sessionDate: string;
  sessionTime: string;
  courtName: string;
  clubName: string;
}

export interface BookingCancellationData {
  memberName: string;
  sessionDate: string;
  sessionTime: string;
  courtName: string;
  reason?: string;
}

export interface ReminderData {
  memberName: string;
  sessionDate: string;
  sessionTime: string;
  courtName: string;
  clubName: string;
}

/**
 * Email Service Interface
 * All email functionality must be accessed through this interface
 */
export interface IEmailService {
  /**
   * Send a booking confirmation email
   */
  sendBookingConfirmation(email: string, data: BookingConfirmationData): Promise<void>;

  /**
   * Send a booking cancellation email
   */
  sendBookingCancellation(email: string, data: BookingCancellationData): Promise<void>;

  /**
   * Send a booking reminder email
   */
  sendBookingReminder(email: string, data: ReminderData): Promise<void>;

  /**
   * Send a generic email using a template
   */
  sendEmail(template: EmailTemplate): Promise<void>;

  /**
   * Send batch emails
   */
  sendBatchEmails(templates: EmailTemplate[]): Promise<void>;
}
