import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { trialTrainingService } from '@/src/application/services/trial-training-service.adapter';
import { EmailService } from '@/src/application/services/email.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trial-trainings:[id]:reminder');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const trialTrainingId = id;

      const trialTraining = await trialTrainingService.getTrialTrainingById(trialTrainingId);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      if (trialTraining.status !== 'scheduled') {
        return NextResponse.json(
          { error: 'Can only send reminders for scheduled trial trainings' },
          { status: 400 }
        );
      }

      // Fetch club contact details from system_settings
      const { data: settingRows } = await auth.supabase
        .from('system_settings')
        .select('key, value')
        .eq('club_id', auth.clubId ?? '')
        .in('key', ['club_address', 'club_phone', 'club_email', 'club_name']);
      const settings: Record<string, string> = {};
      for (const row of settingRows ?? []) {
        settings[row.key] = row.value;
      }

      const success = await EmailService.sendTrialTrainingEmail({
        recipientName: `${trialTraining.participant.firstName} ${trialTraining.participant.lastName}`,
        recipientEmail: trialTraining.participant.email,
        clubName: settings['club_name'] ?? 'SwingZ Tennis Club',
        memberType: 'trial',
        startDate: new Date(trialTraining.scheduledDate),
        clubAddress: settings['club_address'] ?? '',
        clubPhone: settings['club_phone'] ?? '',
        clubEmail: settings['club_email'] ?? '',
      });

      if (!success) {
        return NextResponse.json({ error: 'Failed to send reminder email' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
      log.error('Trial training reminder error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
