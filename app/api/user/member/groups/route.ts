import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

/**
 * GET /api/user/member/groups?clubId=...
 *
 * Returns the active training group IDs for the authenticated member
 * within a specific club. Uses the tgm_member_view_own RLS policy.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const clubId = req.nextUrl.searchParams.get('clubId');
    if (!clubId) {
      return NextResponse.json({ error: 'clubId is required' }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from('training_group_memberships')
      .select('training_group_id')
      .eq('member_id', auth.user.id)
      .eq('club_id', clubId)
      .is('left_at', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch group memberships' }, { status: 500 });
    }

    const groupIds = (data ?? []).map(
      (row: { training_group_id: string }) => row.training_group_id
    );

    return NextResponse.json({ groupIds });
  });
}
