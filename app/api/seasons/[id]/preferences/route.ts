import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, internalErrorResponse, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPreferenceService } from '@/application/services/season-preference.service';
import type { SubmitPreferencesRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:preferences');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
  }>;
}

/** Fachliche Fehler im bisherigen Format `{ error: string }` — Seiten lesen `error` als Text. */
function fail(error: unknown) {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
  }
  log.error('preferences error:', error);
  return internalErrorResponse();
}

/**
 * GET /api/seasons/[id]/preferences
 * Vereins-Admins: alle Präferenzen der Saison. Alle anderen: nur die eigene.
 *
 * Query params (nur Admins): user_id, is_submitted, user_role
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const { searchParams } = new URL(request.url);
      const isSubmitted = searchParams.get('is_submitted');

      const preferences = await new SeasonPreferenceService(auth).list(seasonId, {
        userId: searchParams.get('user_id') ?? undefined,
        userRole: searchParams.get('user_role') ?? undefined,
        isSubmitted: isSubmitted === null ? undefined : isSubmitted === 'true',
      });
      return NextResponse.json({ success: true, preferences, count: preferences.length });
    } catch (error) {
      return fail(error);
    }
  });
}

/**
 * POST /api/seasons/[id]/preferences
 * Eigene Präferenzen abgeben oder aktualisieren. Body: SubmitPreferencesRequest
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const body: SubmitPreferencesRequest = await request.json();
        const { preference, created } = await new SeasonPreferenceService(auth).submit(
          seasonId,
          body
        );
        return NextResponse.json(
          {
            success: true,
            preference,
            message: created
              ? 'Präferenzen erfolgreich übermittelt'
              : 'Präferenzen erfolgreich aktualisiert',
          },
          { status: created ? 201 : 200 }
        );
      } catch (error) {
        return fail(error);
      }
    });
  });
}
