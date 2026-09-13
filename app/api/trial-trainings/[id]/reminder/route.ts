import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { TrialTrainingService } from '@/application/services/trial-training.service';
import { getUserDb } from '@/infrastructure/db';
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

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    try {
      const { id } = await params;
      const trialTrainingId = id;

      const trialTrainingService = new TrialTrainingService(getUserDb(auth));
      const trialTraining = await trialTrainingService.getTrialTrainingById(
        trialTrainingId,
        clubId
      );

      if (!trialTraining) {
        return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
      }

      if (trialTraining.status !== 'scheduled') {
        return NextResponse.json(
          { error: 'Erinnerungen nur für geplante Probetrainings möglich' },
          { status: 400 }
        );
      }

      // Fetch club contact details from system_settings
      const { data: settingRows } = await auth.supabase
        .from('system_settings')
        .select('key, value')
        .eq('club_id', clubId)
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
        return NextResponse.json(
          { error: 'Erinnerungs-E-Mail konnte nicht gesendet werden' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: 'Erinnerung erfolgreich gesendet' });
    } catch (error) {
      log.error('Trial training reminder error:', error);
      return internalErrorResponse();
    }
  });
}
