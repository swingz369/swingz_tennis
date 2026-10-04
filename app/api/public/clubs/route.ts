import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ClubService } from '@/application/services/club.service';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:public:clubs');

/**
 * GET /api/public/clubs — Public club listing (no auth required)
 *
 * Returns a minimal list of clubs (id, name) for use in the
 * onboarding Probetraining form's club selector.
 *
 * Läuft über systemDb (ClubService.listPublic): die clubs-SELECT-Policy
 * verlangt eine Mitgliedschaft, die Interessenten noch nicht haben.
 */
export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  try {
    const data = await ClubService.listPublic();

    return NextResponse.json({ clubs: data });
  } catch (error) {
    log.error('[api/public/clubs] Error:', error);
    return NextResponse.json({ error: 'Vereine konnten nicht geladen werden' }, { status: 500 });
  }
}
