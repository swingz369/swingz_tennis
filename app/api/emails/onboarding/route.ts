import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

const log = createLogger('onboarding-email');

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn('RESEND_API_KEY not configured, email sending disabled');
    return null;
  }
  return new Resend(apiKey);
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin role required');

    try {
      const body = await request.json();
      // Accept both field name conventions (approval workflow sends recipientEmail/recipientName)
      const email: string = body.recipientEmail ?? body.email;
      const firstName: string = body.recipientName ?? body.firstName;
      const clubId: string = body.clubId;

      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }

      const resend = getResendClient();
      if (resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'SWINGZ <noreply@swingz.app>',
          to: email,
          subject: `Willkommen bei SWINGZ${firstName ? `, ${firstName}` : ''}!`,
          html: `<h1>Willkommen!</h1><p>Hallo ${
            firstName || ''
          }, deine Mitgliedschaft im Club ${clubId || 'SWINGZ'} wurde genehmigt.</p>`,
        });
        log.info(`Onboarding email sent to ${email}`);
      } else {
        log.info(`Onboarding email logged (no RESEND_API_KEY) for ${email}`);
      }

      return NextResponse.json({ success: true, message: 'Onboarding email sent' });
    } catch (error: any) {
      log.error('Onboarding email failed', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
