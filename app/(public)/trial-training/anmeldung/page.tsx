import { TrialTrainingService } from '@/application/services/trial-training.service';
import { systemDb } from '@/infrastructure/db';
import TrialSignupForm from '@/components/trial-signup-form';
import { createLogger } from '@/lib/logger';

const log = createLogger('trial-signup:page');

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TrialSignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const participantId = typeof params.p === 'string' ? params.p : '';

  let firstName: string | undefined;
  let email: string | undefined;
  let clubName: string | undefined;

  if (UUID_RE.test(participantId)) {
    try {
      const ctx = await new TrialTrainingService(
        systemDb('öffentlicher Probetraining-Link, kein Login')
      ).getPublicContext(participantId);
      if (ctx) {
        firstName = ctx.firstName;
        email = ctx.email;
        clubName = ctx.clubName ?? undefined;
      }
    } catch (error) {
      log.error('Failed to load trial signup context', error instanceof Error ? error : undefined);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {UUID_RE.test(participantId) ? (
          <TrialSignupForm
            participantId={participantId}
            firstName={firstName}
            email={email}
            clubName={clubName}
          />
        ) : (
          <p className="text-center text-muted-foreground">Ungültiger Link.</p>
        )}
      </div>
    </div>
  );
}
