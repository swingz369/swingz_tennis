import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/persistence/db';
import { clubs } from '@/infrastructure/persistence/schema';
import { asc } from 'drizzle-orm';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

/**
 * GET /api/public/clubs — Public club listing (no auth required)
 *
 * Returns a minimal list of clubs (id, name) for use in the
 * onboarding Probetraining form's club selector.
 *
 * Uses Drizzle directly (bypasses RLS) because the clubs SELECT
 * policy requires active membership — which onboarding users don't
 * have yet.
 */
export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  try {
    const data = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .orderBy(asc(clubs.name));

    return NextResponse.json({ clubs: data });
  } catch (error) {
    console.error('[api/public/clubs] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
  }
}
