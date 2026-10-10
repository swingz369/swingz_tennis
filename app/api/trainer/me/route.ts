import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { TrainerProfileService } from '@/application/services/trainer-profile.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api-trainer-me');

/**
 * GET /api/trainer/me — ID des eigenen Trainer-Profils (`trainer_profiles`, verknüpft über
 * user_id; nicht dieselbe ID wie `trainers.id`). Einziger Aufrufer: /trainer/profile.
 *
 * Lieferte früher alle Einheiten des Trainers samt Statistik (unbegrenzt, ein Auth-Aufruf je
 * Buchung), aber keine `id` — die Profilseite brach deshalb immer mit „Profil-ID nicht
 * gefunden" ab.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'trainer'))) {
      return forbiddenResponse('Zugriff nur für Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const profile = await new TrainerProfileService(auth).getTrainerProfileByUserId(auth.user.id);
      if (!profile) {
        return NextResponse.json(
          { error: 'Trainer-Profil nicht gefunden. Bitte wende dich an den Administrator.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ profile: { id: profile.id } });
    } catch (error) {
      log.error('Eigenes Trainer-Profil nicht lesbar', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}
