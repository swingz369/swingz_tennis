import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import { EmailService } from '@/src/application/services/email.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const trialTrainingId = id;

      const trialTraining = await TrialTrainingService.getTrialTrainingById(trialTrainingId);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      if (trialTraining.status !== 'scheduled') {
        return NextResponse.json(
          { error: 'Can only send reminders for scheduled trial trainings' },
          { status: 400 }
        );
      }

      const success = await EmailService.sendTrialTrainingEmail({
        recipientName: `${trialTraining.participant.firstName} ${trialTraining.participant.lastName}`,
        recipientEmail: trialTraining.participant.email,
        clubName: 'SwingZ Tennis Club',
        memberType: 'trial',
        startDate: new Date(trialTraining.scheduledDate),
        clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
        clubPhone: '+49 123 456 7890',
        clubEmail: 'info@swingz.app',
      });

      if (!success) {
        return NextResponse.json({ error: 'Failed to send reminder email' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
      console.error('Trial training reminder error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
