import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { data: rolesData, error: rolesError } = await auth.supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', auth.user.id)
      .eq('is_active', true);

    if (rolesError) {
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    const roles = (rolesData as Array<{ role: string }>).map((m) => m.role);
    return NextResponse.json({ roles });
  });
}
