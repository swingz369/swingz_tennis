/**
 * sendPasswordResetEmail — Sends a branded password-reset email via Resend.
 *
 * Called by POST /api/auth/forgot-password after generating a Supabase
 * recovery link.  The email is always the same whether the address exists
 * or not (email-enumeration protection happens at the route layer).
 */

import { Resend } from 'resend';
import { env } from '@/lib/env';

// ─── Resend singleton ────────────────────────────────────────────────────────

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (resendInstance) return resendInstance;
  if (!env.RESEND_API_KEY) return null;
  resendInstance = new Resend(env.RESEND_API_KEY);
  return resendInstance;
}

// ─── Email template ──────────────────────────────────────────────────────────

function buildResetEmailHtml(params: { resetUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #1B4332; color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0; }
      .content { background: #f9f9f9; padding: 32px 24px; }
      .cta-btn { display: inline-block; background: #1B4332; color: #fff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .info { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #555; }
      .footer { text-align: center; margin-top: 30px; color: #888; font-size: 13px; }
      .footer a { color: #1B4332; text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0;font-size:24px;">🎾 SwingZ</h1>
      </div>
      <div class="content">
        <h2 style="margin-top:0;">Passwort zurücksetzen</h2>
        <p>Hallo,</p>
        <p>
          wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.
          Klicke auf den folgenden Button, um ein neues Passwort festzulegen:
        </p>
        <p style="text-align:center;">
          <a href="${params.resetUrl}" class="cta-btn">Passwort zurücksetzen</a>
        </p>
        <div class="info">
          <strong>⏱ Gültigkeit:</strong> Dieser Link ist <strong>60&nbsp;Minuten</strong> gültig.<br />
          <strong>🔒 Sicherheit:</strong> Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.
        </div>
        <p style="font-size:14px;color:#666;">
          Falls der Button nicht funktioniert, kopiere folgenden Link in deinen Browser:<br />
          <a href="${params.resetUrl}" style="color:#1B4332;word-break:break-all;">${params.resetUrl}</a>
        </p>
      </div>
      <div class="footer">
        <p>
          <a href="/datenschutz">Datenschutz</a> ·
          <a href="/terms">Nutzungsbedingungen</a> ·
          <a href="/contact">Kontakt</a>
        </p>
        <p>© ${new Date().getFullYear()} SwingZ – Premium Tennis Club Management</p>
      </div>
    </div>
  </body>
</html>`;
}

function buildResetEmailText(resetUrl: string): string {
  return [
    'SwingZ – Passwort zurücksetzen',
    '═══════════════════════════════',
    '',
    'Hallo,',
    '',
    'wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.',
    'Öffne den folgenden Link, um ein neues Passwort festzulegen:',
    '',
    resetUrl,
    '',
    'Dieser Link ist 60 Minuten gültig.',
    '',
    'Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail einfach.',
    'Dein Passwort bleibt unverändert.',
    '',
    '──',
    '© SwingZ – Premium Tennis Club Management',
  ].join('\n');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SendPasswordResetEmailParams {
  /** Recipient email address */
  to: string;
  /** Full Supabase recovery URL (contains the token) */
  resetUrl: string;
}

/**
 * Send a branded password-reset email.
 *
 * Returns `true` on success, `false` if RESEND_API_KEY is missing or sending
 * fails.  Never throws — callers should not leak delivery errors.
 */
export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[sendPasswordResetEmail] RESEND_API_KEY not configured — email skipped');
    }
    return false;
  }

  const from = env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>';

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: 'Passwort zurücksetzen – SwingZ',
      html: buildResetEmailHtml({ resetUrl: params.resetUrl }),
      text: buildResetEmailText(params.resetUrl),
    });

    if (error) {
      console.error('[sendPasswordResetEmail] Resend error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[sendPasswordResetEmail] Unexpected error:', err);
    return false;
  }
}
