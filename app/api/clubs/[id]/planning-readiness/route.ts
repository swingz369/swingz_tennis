import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:planning-readiness');

/**
 * GET /api/clubs/[id]/planning-readiness?seasonId=xxx
 *
 * Bundles 5 readiness checks into a single API call,
 * avoiding 5 round-trips to Supabase from the client.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { id: clubId } = await params;
      const { searchParams } = new URL(_request.url);
      const seasonId = searchParams.get('seasonId');

      const supabase = auth.supabase;

      // Step 1: Get trainer user_ids for this club
      // (trainer_availability has no club_id — join via user_club_memberships)
      const { data: trainerIds } = await (supabase.from('user_club_memberships') as any)
        .select('user_id')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true);

      const trainerUserIdList = (trainerIds ?? []).map((r: any) => r.user_id).filter(Boolean);

      // Step 2: Build query array dynamically
      const queries: Promise<any>[] = [
        // planning members
        (supabase.from('user_club_memberships') as any)
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .eq('role', 'member')
          .eq('is_active', true)
          .eq('include_in_planning', true),

        // trainers
        (supabase.from('user_club_memberships') as any)
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .eq('role', 'trainer')
          .eq('is_active', true),

        // courts
        supabase
          .from('courts')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .eq('is_active', true)
          .eq('usable_for_training', true),

        // preferences
        supabase
          .from('user_training_preferences')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', seasonId ?? ''),
      ];

      // trainer availability — check user_training_preferences (user_role='trainer')
      // because that's what the clustering engine actually reads. The old
      // trainer_availability table (weekly day-of-week patterns) is a separate
      // system that is NOT used by the planning algorithm.
      if (trainerUserIdList.length > 0) {
        queries.push(
          (supabase.from('user_training_preferences') as any)
            .select('id', { count: 'exact', head: true })
            .in('user_id', trainerUserIdList)
            .eq('user_role', 'trainer')
            .eq('season_id', seasonId ?? '')
        );
      } else {
        queries.push(Promise.resolve({ count: 0 }));
      }

      const [
        { count: planningMembers },
        { count: trainerCount },
        { count: courtCount },
        { count: preferenceCount },
        { count: availabilityCount },
      ] = await Promise.all(queries);

      return NextResponse.json({
        planningMembers: planningMembers ?? 0,
        trainerCount: trainerCount ?? 0,
        availabilityCount: availabilityCount ?? 0,
        courtCount: courtCount ?? 0,
        preferenceCount: preferenceCount ?? 0,
      });
    } catch (error) {
      log.error('Planning readiness check error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
