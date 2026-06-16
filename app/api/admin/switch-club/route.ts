import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:switch-club');

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

    // 3. Verify user is superadmin
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperadmin = (memberships ?? []).some((m: any) => m.role === 'superadmin');
    if (!isSuperadmin) {
      return NextResponse.json({ error: 'Only superadmins can switch clubs' }, { status: 403 });
    }

    // 4. Verify club exists (superadmin can manage any club)
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
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
    log.error('[Switch Club] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/switch-club
 * Clears the admin club cookie (reset to no club selected)
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_CLUB_COOKIE);

    return NextResponse.json({
      success: true,
      message: 'Club selection cleared',
    });
  } catch (error) {
    log.error('[Switch Club] Error clearing club:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
