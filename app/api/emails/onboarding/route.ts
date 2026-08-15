import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }

      // Fetch club name from system_settings (matching trial-training route pattern)
      const { data: settingRows } = await auth.supabase
        .from('system_settings')
        .select('key, value')
        .eq('club_id', clubId)
        .in('key', ['club_name']);
      const clubName = settingRows?.find((r) => r.key === 'club_name')?.value || 'SWINGZ';

      const template = EmailService.generateMembershipApprovalEmail({
        recipientName: firstName || 'Mitglied',
        recipientEmail: email,
        clubName,
        memberType: 'member',
      });

      const infraEmail = new InfraEmailService();
      await infraEmail.sendEmail({ to: email, ...template });
      log.info(`Onboarding email sent to ${email}`);

      return NextResponse.json({ success: true, message: 'Onboarding email sent' });
    } catch (error: any) {
      log.error('Onboarding email failed', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
