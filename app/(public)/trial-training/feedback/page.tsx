import { eq } from 'drizzle-orm';
import { db } from '@/infrastructure/persistence/db';
import { trialTrainings, clubs } from '@/infrastructure/persistence/schema';
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
      const rows = await db
        .select({
          firstName: trialTrainings.participant_first_name,
          clubName: clubs.name,
        })
        .from(trialTrainings)
        .leftJoin(clubs, eq(trialTrainings.club_id, clubs.id))
        .where(eq(trialTrainings.participant_id, participantId))
        .limit(1);
      if (rows.length > 0) {
        firstName = rows[0].firstName;
        clubName = rows[0].clubName ?? undefined;
      }
    } catch (error) {
      log.error(
        'Failed to load trial feedback context',
        error instanceof Error ? error : undefined
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 to-brand-light/5 dark:bg-card">
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
