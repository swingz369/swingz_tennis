import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

const log = createLogger('api:public:stats');

/**
 * GET /api/public/stats
 *
 * Returns public platform statistics for the landing page.
 * No authentication required — only returns aggregate counts.
 */
export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;
  try {
    const supabase = createServiceClient();

    // Fetch platform-wide stats in parallel
    const [{ count: totalClubs }, { count: totalSessions }, { count: totalMembers }] =
      await Promise.all([
        supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('sessions').select('id', { count: 'exact', head: true }),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .not('role', 'in', '(trainer,superadmin)'),
      ]);

    return NextResponse.json({
      clubs: totalClubs ?? 0,
      sessions: totalSessions ?? 0,
      members: totalMembers ?? 0,
    });
  } catch (error) {
    log.error('[Public Stats] Error:', error);
    // Return zeros on error — landing page still renders
    return NextResponse.json({ clubs: 0, sessions: 0, members: 0 });
  }
}
