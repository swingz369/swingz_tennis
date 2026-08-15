/**
 * GET /api/me — Returns basic info about the authenticated user and their club
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!auth.user) return forbiddenResponse('Nicht angemeldet');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return NextResponse.json({
      userId: auth.user.id,
      email: auth.user.email,
      role: auth.role,
      clubId: auth.clubId,
    });
  });
}
