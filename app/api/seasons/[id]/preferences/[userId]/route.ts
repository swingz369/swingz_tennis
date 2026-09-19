import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPreferenceService } from '@/application/services/season-preference.service';
import type { UpdatePreferencesRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:preferences:[userId]');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
    userId: string;
  }>;
}

/** Fachliche Fehler im bisherigen Format `{ error: string }` — Seiten lesen `error` als Text. */
function fail(error: unknown) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error('preferences/[userId] error:', error);
  return internalErrorResponse();
}

/** GET — Präferenz eines Nutzers. Nutzer sehen nur ihre eigene, Vereins-Admins jede. */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId, userId } = await context.params;
      const preference = await new SeasonPreferenceService(auth).get(seasonId, userId);
      return NextResponse.json({ success: true, preference });
    } catch (error) {
      return fail(error);
    }
  });
}

/** PATCH — Präferenz ändern (Entwurf). Nutzer nur die eigene, solange offen; Vereins-Admins jede. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId, userId } = await context.params;
        const body: UpdatePreferencesRequest = await request.json();
        const preference = await new SeasonPreferenceService(auth).update(seasonId, userId, body);
        return NextResponse.json({
          success: true,
          preference,
          message: 'Präferenz erfolgreich aktualisiert',
        });
      } catch (error) {
        return fail(error);
      }
    });
  });
}

/** DELETE — Präferenz löschen. Nutzer nur die eigene, Vereins-Admins jede. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId, userId } = await context.params;
        await new SeasonPreferenceService(auth).remove(seasonId, userId);
        return NextResponse.json({ success: true, message: 'Präferenz erfolgreich gelöscht' });
      } catch (error) {
        return fail(error);
      }
    });
  });
}
