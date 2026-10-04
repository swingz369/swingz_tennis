import { TrialTrainingService } from '@/application/services/trial-training.service';
import { systemDb } from '@/infrastructure/db';
import TrialFeedbackForm from '@/components/trial-feedback-form';
import { createLogger } from '@/lib/logger';

const log = createLogger('trial-feedback:page');

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TrialFeedbackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const participantId = typeof params.p === 'string' ? params.p : '';

  let clubName: string | undefined;
  let firstName: string | undefined;

  if (UUID_RE.test(participantId)) {
    try {
      const ctx = await new TrialTrainingService(
        systemDb('öffentlicher Probetraining-Link, kein Login')
      ).getPublicContext(participantId);
      if (ctx) {
        firstName = ctx.firstName;
        clubName = ctx.clubName ?? undefined;
      }
    } catch (error) {
      log.error(
        'Failed to load trial feedback context',
        error instanceof Error ? error : undefined
      );
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {UUID_RE.test(participantId) ? (
          <TrialFeedbackForm
            participantId={participantId}
            clubName={clubName}
            firstName={firstName}
          />
        ) : (
          <p className="text-center text-muted-foreground">Ungültiger Link.</p>
        )}
      </div>
    </div>
  );
}
