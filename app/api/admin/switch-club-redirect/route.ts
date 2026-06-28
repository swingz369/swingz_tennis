import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/switch-club-redirect?clubId=xxx
 * Superadmin wählt einen Verein → Cookie setzen → /admin weiterleiten
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth();

  // Only superadmin
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = (memberships ?? []).some((m: any) => m.role === 'superadmin');
  if (!isSuperadmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.redirect(new URL('/select-admin-club', request.url));
  }

  // Validate club exists
  const { data: club } = await supabase.from('clubs').select('id').eq('id', clubId).maybeSingle();

  if (!club) {
    return NextResponse.redirect(new URL('/select-admin-club', request.url));
  }

  const response = NextResponse.redirect(new URL('/admin', request.url));
  response.cookies.set(ADMIN_CLUB_COOKIE, clubId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_CLUB_COOKIE_MAX_AGE,
    path: '/',
  });
  return response;
}
