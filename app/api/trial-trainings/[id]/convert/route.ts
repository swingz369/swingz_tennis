import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import { EmailService } from '@/src/application/services/email.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();
      const { memberId, memberType, startDate, assignedGroup } = body;

      if (!memberId) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      const trialTraining = await TrialTrainingService.getTrialTrainingById(id);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      if (trialTraining.status !== 'completed') {
        return NextResponse.json(
          { error: 'Can only convert completed trial trainings' },
          { status: 400 }
        );
      }

      const updated = await TrialTrainingService.convertTrialToMember(id, memberId);

      if (!updated) {
        return NextResponse.json({ error: 'Failed to convert trial training' }, { status: 500 });
      }

      try {
        await EmailService.sendWelcomeEmail({
          recipientName: `${trialTraining.participant.firstName} ${trialTraining.participant.lastName}`,
          recipientEmail: trialTraining.participant.email,
          clubName: 'SwingZ Tennis Club',
          memberType: memberType || 'member',
          startDate: startDate ? new Date(startDate) : undefined,
          assignedGroup,
          clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
          clubPhone: '+49 123 456 7890',
          clubEmail: 'info@swingz.app',
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      return NextResponse.json({
        success: true,
        trialTraining: updated,
        message: 'Trial training converted to member successfully',
      });
    } catch (error) {
      console.error('Trial training conversion error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
