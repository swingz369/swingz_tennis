/**
 * API Route: Set Admin Club Context
 * Allows superadmin to switch between clubs
 * Rate limited to prevent abuse
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createRateLimitedHandler, RATE_LIMITS } from '@/lib/rate-limit';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';

export const POST = createRateLimitedHandler('api', async function handler(request: NextRequest) {
  try {
    const { clubId } = await request.json();

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 });
    }

    // Verify user is superadmin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperAdmin = memberships?.some((m: any) => m.role === 'superadmin');

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only superadmins can switch clubs' },
        { status: 403 }
      );
    }

    // Verify club exists
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    // Set cookie with selected club
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_CLUB_COOKIE, clubId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_CLUB_COOKIE_MAX_AGE,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      clubId,
      clubName: club.name,
    });
  } catch (error) {
    console.error('Error setting admin club:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = createRateLimitedHandler('api', async function handler(request: NextRequest) {
  try {
    // Clear the selected club cookie
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_CLUB_COOKIE);

    return NextResponse.json({
      success: true,
      message: 'Club selection cleared',
    });
  } catch (error) {
    console.error('Error clearing admin club:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
