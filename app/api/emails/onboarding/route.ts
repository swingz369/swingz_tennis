import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { EmailService } from '@/src/application/services/email.service';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const {
        type,
        recipientName,
        recipientEmail,
        clubName = 'SwingZ Tennis Club',
        memberType,
        startDate,
        assignedGroup,
        temporaryPassword,
        welcomeGuideUrl,
        clubAddress,
        clubPhone,
        clubEmail,
        reason,
      } = body;

      let success = false;

      switch (type) {
        case 'welcome':
          success = await EmailService.sendWelcomeEmail({
            recipientName,
            recipientEmail,
            clubName,
            memberType,
            startDate: startDate ? new Date(startDate) : undefined,
            assignedGroup,
            temporaryPassword,
            welcomeGuideUrl,
            clubAddress,
            clubPhone,
            clubEmail,
          });
          break;

        case 'trial':
          success = await EmailService.sendTrialTrainingEmail({
            recipientName,
            recipientEmail,
            clubName,
            memberType: 'trial',
            startDate: startDate ? new Date(startDate) : undefined,
            clubAddress,
            clubPhone,
            clubEmail,
          });
          break;

        case 'approval':
          success = await EmailService.sendMembershipApprovalEmail({
            recipientName,
            recipientEmail,
            clubName,
            memberType: memberType || 'member',
            startDate: startDate ? new Date(startDate) : undefined,
            assignedGroup,
            clubAddress,
            clubPhone,
            clubEmail,
          });
          break;

        case 'rejection':
          if (!reason) {
            return NextResponse.json(
              { error: 'Reason is required for rejection emails' },
              { status: 400 }
            );
          }
          success = await EmailService.sendRejectionEmail({
            recipientName,
            recipientEmail,
            clubName,
            memberType: memberType || 'member',
            reason,
            clubAddress,
            clubPhone,
            clubEmail,
          });
          break;

        default:
          return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
      }

      if (success) {
        return NextResponse.json({ success: true, message: 'Email sent successfully' });
      } else {
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
    } catch (error) {
      console.error('Email API error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
