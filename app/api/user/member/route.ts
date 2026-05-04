import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');
  if (hasDemoMode) {
    return NextResponse.json({
      memberId: 'demo-member',
      email: 'demo@swingz.com',
      name: 'Demo User',
    });
  }

  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    return NextResponse.json({
      memberId: auth.user.id,
      email: auth.user.email,
      name: auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || 'Member',
    });
  });
}
