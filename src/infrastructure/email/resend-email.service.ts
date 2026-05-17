/**
 * Resend Email Service Implementation
 * Infrastructure Layer
 *
 * Konkrete Implementierung der EmailService Interface mit Resend
 */

import { Resend } from 'resend';
import type {
  EmailService,
  EmailRecipient,
  EmailTemplate,
} from '@/domain/services/email-service.interface';
import type { Booking } from '@/domain/entities/booking';
import { env } from '@/lib/env';

export class ResendEmailService implements EmailService {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    if (!env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Email sending will be skipped.');
    }
    this.resend = new Resend(env.RESEND_API_KEY);
    this.fromEmail = env.EMAIL_FROM || 'noreply@swingz.app';
  }

  async sendBookingConfirmation(booking: Booking, recipient: EmailRecipient): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: 'Buchungsbestätigung - SwingZ',
      html: this.renderBookingConfirmation(booking, recipient),
    });
  }

  async sendBookingCancellation(
    booking: Booking,
    recipient: EmailRecipient,
    reason: string
  ): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: 'Buchung storniert - SwingZ',
      html: this.renderBookingCancellation(booking, recipient, reason),
    });
  }

  async sendSessionReminder(
    _sessionId: string,
    recipients: EmailRecipient[],
    sessionDetails: {
      date: Date;
      time: string;
      court: string;
      trainer: string;
    }
  ): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    const promises = recipients.map((recipient) =>
      this.resend.emails.send({
        from: this.fromEmail,
        to: recipient.email,
        subject: 'Erinnerung: Dein Training morgen - SwingZ',
        html: this.renderSessionReminder(recipient, sessionDetails),
      })
    );

    await Promise.all(promises);
  }

  async sendInvoice(
    _invoiceId: string,
    recipient: EmailRecipient,
    invoiceDetails: {
      invoiceNumber: string;
      amount: number;
      dueDate: Date;
      items: Array<{ description: string; amount: number }>;
    }
  ): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    // Generate PDF invoice attachment using existing utility
    let attachments: Array<{ filename: string; content: string }> = [];
    try {
      const { generateInvoicePDFBase64 } = await import('@/lib/pdf/invoice-pdf-utils');

      const pdfBase64 = await generateInvoicePDFBase64({
        invoice: {
          id: _invoiceId,
          invoice_number: invoiceDetails.invoiceNumber,
          amount: invoiceDetails.amount,
          due_date: invoiceDetails.dueDate.toISOString(),
          status: 'sent',
          member_id: '',
          club_id: '',
          created_at: new Date().toISOString(),
          items: invoiceDetails.items.map((item, idx) => ({
            id: `item-${idx}`,
            invoice_id: _invoiceId,
            description: item.description,
            quantity: 1,
            unit_price: item.amount,
            total_price: item.amount,
            created_at: new Date().toISOString(),
          })),
        } as any,
        clubName: 'SwingZ Tennis Club',
        clubAddress: '',
        clubEmail: this.fromEmail,
        clubPhone: '',
        memberName: recipient.name || 'Mitglied',
        memberAddress: '',
        memberEmail: recipient.email,
      });

      attachments = [
        {
          filename: `Rechnung-${invoiceDetails.invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ];
    } catch (pdfError) {
      console.warn('Failed to generate PDF attachment, sending without it:', pdfError);
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: `Rechnung ${invoiceDetails.invoiceNumber} - SwingZ`,
      html: this.renderInvoice(invoiceDetails, recipient),
      attachments,
    });
  }

  async sendDunningNotice(
    _invoiceId: string,
    recipient: EmailRecipient,
    level: 1 | 2 | 3,
    dueDate: Date,
    amount: number
  ): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    const subject = `${level}. Mahnung - Rechnung überfällig - SwingZ`;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject,
      html: this.renderDunningNotice(recipient, level, dueDate, amount),
    });
  }

  async sendWelcomeEmail(recipient: EmailRecipient, clubName: string): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: `Willkommen bei ${clubName} - SwingZ`,
      html: this.renderWelcome(recipient, clubName),
    });
  }

  async sendPasswordReset(
    recipient: EmailRecipient,
    resetToken: string,
    expiresAt: Date
  ): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: 'Passwort zurücksetzen - SwingZ',
      html: this.renderPasswordReset(recipient, resetUrl, expiresAt),
    });
  }

  async sendCustomEmail(recipient: EmailRecipient, template: EmailTemplate): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    await this.resend.emails.send({
      from: this.fromEmail,
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendBulkEmail(recipients: EmailRecipient[], template: EmailTemplate): Promise<void> {
    if (!env.RESEND_API_KEY) return;

    const promises = recipients.map((recipient) =>
      this.resend.emails.send({
        from: this.fromEmail,
        to: recipient.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    );

    await Promise.all(promises);
  }

  // Template rendering methods
  private renderBookingConfirmation(booking: Booking, recipient: EmailRecipient): string {
    return `
      <h1>Buchungsbestätigung</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Deine Buchung wurde bestätigt.</p>
      <p><strong>Buchungs-ID:</strong> ${booking.getId().getValue()}</p>
      <p>Wir freuen uns auf dich!</p>
    `;
  }

  private renderBookingCancellation(
    _booking: Booking,
    recipient: EmailRecipient,
    reason: string
  ): string {
    return `
      <h1>Buchung storniert</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Deine Buchung wurde storniert.</p>
      <p><strong>Grund:</strong> ${reason}</p>
    `;
  }

  private renderSessionReminder(
    recipient: EmailRecipient,
    details: { date: Date; time: string; court: string; trainer: string }
  ): string {
    return `
      <h1>Training-Erinnerung</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Dein Training findet morgen statt:</p>
      <ul>
        <li>Datum: ${details.date.toLocaleDateString('de-DE')}</li>
        <li>Uhrzeit: ${details.time}</li>
        <li>Platz: ${details.court}</li>
        <li>Trainer: ${details.trainer}</li>
      </ul>
    `;
  }

  private renderInvoice(
    invoiceDetails: {
      invoiceNumber: string;
      amount: number;
      dueDate: Date;
      items: Array<{ description: string; amount: number }>;
    },
    recipient: EmailRecipient
  ): string {
    const itemsHtml = invoiceDetails.items
      .map(
        (item) => `
        <li>${item.description}: ${item.amount.toFixed(2)} €</li>
      `
      )
      .join('');

    return `
      <h1>Rechnung ${invoiceDetails.invoiceNumber}</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Anbei findest du deine Rechnung.</p>
      <ul>${itemsHtml}</ul>
      <p><strong>Gesamtbetrag:</strong> ${invoiceDetails.amount.toFixed(2)} €</p>
      <p><strong>Fälligkeitsdatum:</strong> ${invoiceDetails.dueDate.toLocaleDateString('de-DE')}</p>
    `;
  }

  private renderDunningNotice(
    recipient: EmailRecipient,
    level: number,
    dueDate: Date,
    amount: number
  ): string {
    return `
      <h1>${level}. Mahnung</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Deine Rechnung ist überfällig.</p>
      <p><strong>Fälligkeitsdatum:</strong> ${dueDate.toLocaleDateString('de-DE')}</p>
      <p><strong>Betrag:</strong> ${amount.toFixed(2)} €</p>
    `;
  }

  private renderWelcome(recipient: EmailRecipient, clubName: string): string {
    return `
      <h1>Willkommen bei ${clubName}!</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Schön, dass du dabei bist!</p>
    `;
  }

  private renderPasswordReset(
    recipient: EmailRecipient,
    resetUrl: string,
    expiresAt: Date
  ): string {
    return `
      <h1>Passwort zurücksetzen</h1>
      <p>Hallo ${recipient.name},</p>
      <p>Klicke auf den Link, um dein Passwort zurückzusetzen:</p>
      <p><a href="${resetUrl}">Passwort zurücksetzen</a></p>
      <p>Der Link ist gültig bis ${expiresAt.toLocaleString('de-DE')}.</p>
    `;
  }
}
