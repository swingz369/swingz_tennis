import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:feedback:ratings');

// GET /api/feedback/ratings - Get trainer rating summaries
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const trainerId = url.searchParams.get('trainerId');
    const clubId = url.searchParams.get('clubId');

    if (!trainerId && !clubId) {
      return NextResponse.json({ error: 'trainerId or clubId required' }, { status: 400 });
    }

    try {
      const supabase = await createClient();

      let query = supabase.from('trainer_rating_summary').select('*');

      if (trainerId) {
        query = query.eq('trainer_id', trainerId);
      }
      if (clubId) {
        query = query.eq('club_id', clubId);
      }

      const { data, error } = await query;

      if (error) {
        log.error('Failed to fetch rating summaries:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching rating summaries:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
