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
      clubId: 'demo-club',
      club: { id: 'demo-club', name: 'Demo Tennis Club', maxMembers: 100, status: 'active' },
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

    const { data: memberships, error: membershipError } = await auth.supabase
      .from('user_club_memberships')
      .select('club_id, clubs (id, name, max_members, status)')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No club membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const club = membership.clubs as {
      id: string;
      name: string;
      max_members: number;
      status: string;
    };
    return NextResponse.json({
      clubId: membership.club_id,
      club: { id: club.id, name: club.name, maxMembers: club.max_members, status: club.status },
    });
  });
}
