import { Resend } from 'resend';
import type {
  IEmailService,
  EmailTemplate,
  BookingConfirmationData,
  BookingCancellationData,
  ReminderData,
} from '@/domain/services';

export interface EmailConfig {
  from: string;
  replyTo?: string | undefined;
}

const config: EmailConfig = {
  from: process.env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>',
  replyTo: process.env.EMAIL_REPLY_TO,
};

let resendInstance: Resend | null;
function getResend(): Resend | null {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set, email sending disabled');
      return null;
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const templates = {
  bookingConfirmation: (data: {
    memberName: string;
    sessionStartFormatted: string;
    sessionEndFormatted: string;
    trainerName?: string | undefined;
    courtName?: string | undefined;
    clubName?: string | undefined;
  }): { subject: string; html: string; text: string } => ({
    subject: `Training bestätigt – ${data.sessionStartFormatted}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1B4332; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
            .details { margin: 20px 0; }
            .details table { width: 100%; border-collapse: collapse; }
            .details td { padding: 8px; border-bottom: 1px solid #ddd; }
            .details td:first-child { font-weight: bold; width: 40%; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🎾 SwingZ</h1></div>
            <div class="content">
              <h2>Training bestätigt!</h2>
              <p>Hallo ${data.memberName},</p>
              <p>Dein Training wurde erfolgreich gebucht. Hier sind die Details:</p>
              <div class="details">
                <table>
                  <tr><td>Datum & Uhrzeit</td><td>${data.sessionStartFormatted} - ${data.sessionEndFormatted}</td></tr>
                  ${data.trainerName ? `<tr><td>Trainer</td><td>${data.trainerName}</td></tr>` : ''}
                  ${data.courtName ? `<tr><td>Platz</td><td>${data.courtName}</td></tr>` : ''}
                  ${data.clubName ? `<tr><td>Verein</td><td>${data.clubName}</td></tr>` : ''}
                </table>
              </div>
              <p>Bitte erscheine pünktlich und bring falls benötigt Equipment mit.</p>
            </div>
            <div class="footer"><p>Dein SwingZ-Team</p></div>
          </div>
        </body>
      </html>
    `,
    text: `Hallo ${data.memberName},\n\nDein Training am ${data.sessionStartFormatted} wurde bestätigt.\n\nTrainer: ${data.trainerName || 'Wird später bekannt gegeben'}\nOrt: ${data.courtName || 'Wird später bekannt gegeben'}\n\nWir freuen uns auf deinen Besuch!\n\nDein SwingZ-Team`,
  }),

  bookingCancellation: (data: {
    memberName: string;
    reason: string;
    notes?: string | undefined;
    sessionStartFormatted?: string | undefined;
  }): { subject: string; html: string; text: string } => ({
    subject: `Buchung storniert`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Buchung storniert</h1></div>
            <div class="content">
              <p>Hallo ${data.memberName},</p>
              <p>Deine Buchung wurde storniert.</p>
              ${data.sessionStartFormatted ? `<p><strong>Termin:</strong> ${data.sessionStartFormatted}</p>` : ''}
              <p><strong>Grund:</strong> ${data.reason}</p>
              ${data.notes ? `<p><strong>Notiz:</strong> ${data.notes}</p>` : ''}
              <p>Bei Fragen wende dich bitte an deinen Trainer oder den Verein.</p>
            </div>
            <div class="footer"><p>Dein SwingZ-Team</p></div>
          </div>
        </body>
      </html>
    `,
    text: `Hallo ${data.memberName},\n\nDeine Buchung wurde storniert.\nGrund: ${data.reason}\n${data.notes ? `Notiz: ${data.notes}` : ''}\n\nBei Fragen wende dich bitte an deinen Trainer oder den Verein.\n\nDein SwingZ-Team`,
  }),

  bookingStatusChanged: (data: {
    memberName: string;
    newStatus: 'confirmed' | 'cancelled' | 'no_show';
    sessionStart: Date;
    sessionEnd: Date;
    clubName?: string | undefined;
  }): { subject: string; html: string; text: string } => {
    const statusLabels = {
      confirmed: 'bestätigt',
      cancelled: 'storniert',
      no_show: 'als nicht erschienen markiert',
    };
    const statusLabel = statusLabels[data.newStatus];
    const subject = `Buchungsstatus geändert: ${statusLabel}`;

    const formatDate = (d: Date) =>
      d.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    return {
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${data.newStatus === 'confirmed' ? '#1B4332' : data.newStatus === 'cancelled' ? '#dc2626' : '#6b7280'}; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
              .details { margin: 20px 0; }
              .details table { width: 100%; border-collapse: collapse; }
              .details td { padding: 8px; border-bottom: 1px solid #ddd; }
              .details td:first-child { font-weight: bold; width: 40%; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h1>Buchungsstatus geändert</h1></div>
              <div class="content">
                <p>Hallo ${data.memberName},</p>
                <p>Der Status deiner Buchung wurde geändert zu <strong>${statusLabel}</strong>.</p>
                <div class="details">
                  <table>
                    <tr><td>Datum & Uhrzeit</td><td>${formatDate(data.sessionStart)} - ${formatDate(data.sessionEnd)}</td></tr>
                    ${data.clubName ? `<tr><td>Verein</td><td>${data.clubName}</td></tr>` : ''}
                  </table>
                </div>
                <p>Bei Fragen wende dich bitte an deinen Trainer oder den Verein.</p>
              </div>
              <div class="footer"><p>Dein SwingZ-Team</p></div>
            </div>
          </body>
        </html>
      `,
      text: `Hallo ${data.memberName},\n\nDer Status deiner Buchung wurde geändert zu: ${statusLabel}\n\nZeit: ${formatDate(data.sessionStart)} - ${formatDate(data.sessionEnd)}\n${data.clubName ? `Verein: ${data.clubName}` : ''}\n\nBei Fragen wende dich bitte an deinen Trainer oder den Verein.\n\nDein SwingZ-Team`,
    };
  },

  bookingReminder: (data: {
    memberName: string;
    sessionStartFormatted: string;
    sessionEndFormatted: string;
    trainerName?: string | undefined;
    courtName?: string | undefined;
  }): { subject: string; html: string; text: string } => ({
    subject: `Erinnerung: Training morgen um ${data.sessionStartFormatted}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>⏰ Training Erinnerung</h1></div>
            <div class="content">
              <p>Hallo ${data.memberName},</p>
              <p>Morgen um <strong>${data.sessionStartFormatted}</strong> hast du ein Training.</p>
              <div class="details">
                <table>
                  <tr><td>Uhrzeit</td><td>${data.sessionStartFormatted} - ${data.sessionEndFormatted}</td></tr>
                  ${data.trainerName ? `<tr><td>Trainer</td><td>${data.trainerName}</td></tr>` : ''}
                  ${data.courtName ? `<tr><td>Platz</td><td>${data.courtName}</td></tr>` : ''}
                </table>
              </div>
              <p>Bitte erscheine pünktlich und bring falls benötigt Equipment mit.</p>
            </div>
            <div class="footer"><p>Dein SwingZ-Team</p></div>
          </div>
        </body>
      </html>
    `,
    text: `Hallo ${data.memberName},\n\nMorgen um ${data.sessionStartFormatted} hast du ein Training bei ${data.trainerName || 'deinem Trainer'}.\n\nBitte erscheine pünktlich und bring falls benötigt Equipment mit.\n\nDein SwingZ-Team`,
  }),

  memberStatus: (data: {
    memberName: string;
    clubName: string;
    isActive: boolean;
  }): { subject: string; html: string; text: string } => ({
    subject: data.isActive ? 'Mitgliedschaft aktiviert' : 'Mitgliedschaft deaktiviert',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${data.isActive ? '#1B4332' : '#6b7280'}; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>${data.isActive ? '🎉 Willkommen!' : ' ℹ️ Mitgliedschafts-Update'}</h1></div>
            <div class="content">
              <p>Hallo ${data.memberName},</p>
              ${
                data.isActive
                  ? `<p>Deine Mitgliedschaft im Verein "<strong>${data.clubName}</strong>" wurde aktiviert.</p>
                   <p>Willkommen an Board! Wir freuen uns, dich dabei zu haben.</p>`
                  : `<p>Deine Mitgliedschaft im Verein "<strong>${data.clubName}</strong>" wurde deaktiviert.</p>
                   <p>Bei Fragen wende dich bitte an den Verein.</p>`
              }
            </div>
            <div class="footer"><p>Dein SwingZ-Team</p></div>
          </div>
        </body>
      </html>
    `,
    text: data.isActive
      ? `Hallo ${data.memberName},\n\nDeine Mitgliedschaft im Verein "${data.clubName}" wurde aktiviert.\n\nWillkommen an Board!\n\nDein SwingZ-Team`
      : `Hallo ${data.memberName},\n\nDeine Mitgliedschaft im Verein "${data.clubName}" wurde deaktiviert.\n\nBei Fragen wende dich bitte an den Verein.\n\nDein SwingZ-Team`,
  }),

  roleChange: (data: {
    memberName: string;
    clubName: string;
    oldRole: string;
    newRole: string;
  }): { subject: string; html: string; text: string } => {
    const roleLabels: Record<string, string> = {
      member: 'Mitglied',
      trainer: 'Trainer',
      admin: 'Admin',
      superadmin: 'Superadmin',
    };
    const oldLabel = roleLabels[data.oldRole] || data.oldRole;
    const newLabel = roleLabels[data.newRole] || data.newRole;

    return {
      subject: 'Deine Rolle wurde geändert',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1B4332; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
              .details { margin: 20px 0; }
              .details table { width: 100%; border-collapse: collapse; }
              .details td { padding: 8px; border-bottom: 1px solid #ddd; }
              .details td:first-child { font-weight: bold; width: 40%; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h1>Rollen-Update</h1></div>
              <div class="content">
                <p>Hallo ${data.memberName},</p>
                <p>Deine Rolle im Verein "<strong>${data.clubName}</strong>" wurde geändert:</p>
                <div class="details">
                  <table>
                    <tr><td>Bisherige Rolle</td><td>${oldLabel}</td></tr>
                    <tr><td>Neue Rolle</td><td><strong>${newLabel}</strong></td></tr>
                  </table>
                </div>
                <p>Bitte beachte die damit verbundenen Berechtigungen. Bei Fragen wende dich an deinen Verein.</p>
              </div>
              <div class="footer"><p>Dein SwingZ-Team</p></div>
            </div>
          </body>
        </html>
      `,
      text: `Hallo ${data.memberName},\n\nDeine Rolle im Verein "${data.clubName}" wurde geändert:\n\nBisher: ${oldLabel}\nNeu: ${newLabel}\n\nBitte beachte die damit verbundenen Berechtigungen.\n\nDein SwingZ-Team`,
    };
  },

  invitation: (data: {
    memberName: string;
    clubName: string;
    loginUrl: string;
    resetPasswordUrl: string;
  }): { subject: string; html: string; text: string } => ({
    subject: `Einladung zu ${data.clubName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1B4332; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
            .cta { display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🎾 Willkommen bei SwingZ!</h1></div>
            <div class="content">
              <p>Hallo ${data.memberName},</p>
              <p>Du wurdest zum Verein "<strong>${data.clubName}</strong>" eingeladen. Um beizutreten, melde dich mit deiner E-Mail-Adresse an und setze ein Passwort fest.</p>
              <p style="text-align: center;">
                <a href="${data.loginUrl}" class="cta">Anmelden & Passwort setzen</a>
              </p>
              <p>Falls du bereits ein Konto hast, kannst du dich direkt <a href="${data.loginUrl}">hier anmelden</a>.</p>
              <p>Bei Fragen wende dich bitte an deinen Verein.</p>
            </div>
            <div class="footer"><p>Dein SwingZ-Team</p></div>
          </div>
        </body>
      </html>
    `,
    text: `Hallo ${data.memberName},\n\nDu wurdest zum Verein "${data.clubName}" eingeladen.\n\nMelde dich an und setze ein Passwort fest: ${data.loginUrl}\n\nBei Fragen wende dich bitte an deinen Verein.\n\nDein SwingZ-Team`,
  }),
};

/**
 * EmailService Implementation
 * Implements IEmailService interface using Resend API
 */
export class EmailService implements IEmailService {
  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(email: string, data: BookingConfirmationData): Promise<void> {
    const template = templates.bookingConfirmation({
      memberName: data.memberName,
      sessionStartFormatted: `${data.sessionDate} ${data.sessionTime}`,
      sessionEndFormatted: '', // Not provided in interface
      courtName: data.courtName,
      clubName: data.clubName,
    });
    await this.sendEmailInternal(email, template);
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellation(email: string, data: BookingCancellationData): Promise<void> {
    const template = templates.bookingCancellation({
      memberName: data.memberName,
      reason: data.reason || 'Keine Angabe',
      sessionStartFormatted: `${data.sessionDate} ${data.sessionTime}`,
    });
    await this.sendEmailInternal(email, template);
  }

  /**
   * Send booking reminder email
   */
  async sendBookingReminder(email: string, data: ReminderData): Promise<void> {
    const template = templates.bookingReminder({
      memberName: data.memberName,
      sessionStartFormatted: `${data.sessionDate} ${data.sessionTime}`,
      sessionEndFormatted: '', // Not in template
      courtName: data.courtName,
    });
    await this.sendEmailInternal(email, template);
  }

  /**
   * Send generic email using template
   */
  async sendEmail(template: EmailTemplate): Promise<void> {
    await this.sendEmailInternal(template.to, {
      subject: template.subject,
      html: template.html,
      text: template.text || '',
    });
  }

  /**
   * Send batch emails
   */
  async sendBatchEmails(templates: EmailTemplate[]): Promise<void> {
    await Promise.all(templates.map((t) => this.sendEmail(t)));
  }

  /**
   * Internal helper to send email via Resend
   */
  private async sendEmailInternal(
    to: string,
    template: { subject: string; html: string; text: string }
  ): Promise<void> {
    const resend = getResend();
    if (!resend) {
      console.log('Email skipped: RESEND_API_KEY not configured', {
        to,
        subject: template.subject,
      });
      return;
    }

    try {
      await resend.emails.send({
        from: config.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        ...(config.replyTo ? { replyTo: config.replyTo } : {}),
      });
      console.log('Email sent:', { to, subject: template.subject });
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }
}
