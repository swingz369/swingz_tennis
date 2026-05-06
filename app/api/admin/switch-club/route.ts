import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';

/**
 * POST /api/admin/switch-club
 *
 * Allows superadmin users to switch their active club context
 * Pattern from INTEGRATION_ROADMAP.md Phase 1.3
 *
 * Request body: { clubId: string }
 * Response: { success: boolean } | { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const auth = await requireAuth();
    const { supabase, user } = auth;

    // 2. Parse request
    const body = await req.json();
    const { clubId } = body;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId is required' }, { status: 400 });
    }

    // 3. Verify user is superadmin and has access to this club
    const { data: membership, error } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .single();

    if (error || !membership) {
      return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
    }

    if (membership.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can switch clubs' }, { status: 403 });
    }

    // 4. Set cookie with club selection
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_CLUB_COOKIE, clubId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_CLUB_COOKIE_MAX_AGE,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Switch Club] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
