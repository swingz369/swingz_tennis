import { NextResponse, type NextRequest } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { runSeasonDryRun } from '@/lib/season-planning/dry-run.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:dry-run');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimit) return rateLimit;

  return withApiAuth(request, async (auth) => {
    const isAdmin = verifyRole(auth, 'admin');
    const isSuperadmin = verifyRole(auth, 'superadmin');
    if (!isAdmin && !isSuperadmin) {
      return forbiddenResponse('Nur Admins dürfen den Dry-Run starten');
    }

    const { id: seasonId } = await context.params;
    if (!seasonId) {
      return NextResponse.json({ ok: false, error: 'season_id erforderlich' }, { status: 400 });
    }

    try {
      const result = await runSeasonDryRun(seasonId);
      if (!result.ok) {
        const status = result.code === 'season_not_found' ? 404 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    } catch (err) {
      log.error('Dry-Run fehlgeschlagen', { err, seasonId });
      return NextResponse.json(
        { ok: false, error: 'Interner Fehler beim Dry-Run', code: 'internal' },
        { status: 500 }
      );
    }
  });
}
