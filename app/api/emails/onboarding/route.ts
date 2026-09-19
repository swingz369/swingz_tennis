import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/typed-helpers';
import { internalErrorResponse } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { EmailService } from '@/src/application/services/email.service';
import { EmailService as InfraEmailService } from '@/src/infrastructure/email/email.service';

const log = createLogger('onboarding-email');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin-Rolle erforderlich');

    try {
      const body = await request.json();
      // Accept both field name conventions (approval workflow sends recipientEmail/recipientName)
      const email: string = body.recipientEmail ?? body.email;
      const firstName: string = body.recipientName ?? body.firstName;
      const clubId: string | null = body.clubId ?? auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
      }

      if (!email) {
        return NextResponse.json({ error: 'E-Mail erforderlich' }, { status: 400 });
      }

      const { data: clubRow } = await auth.supabase
        .from('clubs')
        .select('name')
        .eq('id', clubId)
        .maybeSingle();
      const clubName = clubRow?.name || 'Dein Verein';

      const template = EmailService.generateMembershipApprovalEmail({
        recipientName: firstName || 'Mitglied',
        recipientEmail: email,
        clubName,
        memberType: 'member',
      });

      const infraEmail = new InfraEmailService();
      await infraEmail.sendEmail({ to: email, ...template });
      log.info(`Onboarding email sent to ${email}`);

      return NextResponse.json({ success: true, message: 'Onboarding-E-Mail gesendet' });
    } catch (error) {
      log.error('Onboarding email failed', { error: getErrorMessage(error) });
      return internalErrorResponse();
    }
  });
}
