import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/admin/switch-club-redirect?clubId=xxx
 * Owner/Superadmin wählt einen Verein → Cookie setzen → /admin weiterleiten
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth();

  // Only platform staff (owner/superadmin)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isOwner = (memberships ?? []).some((m: any) => m.role === 'owner');
  const isSuperadmin = (memberships ?? []).some((m: any) => m.role === 'superadmin');
  if (!isOwner && !isSuperadmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.redirect(
      new URL(isOwner ? '/owner/clubs' : '/select-admin-club', request.url)
    );
  }

  // Owner: any existing club. Superadmin: only clubs their Tennisschule
  // actually manages — a real user_club_memberships row (role='superadmin')
  // for this exact clubId, not just "club exists somewhere on the platform".
  const hasAccess = isOwner
    ? Boolean((await supabase.from('clubs').select('id').eq('id', clubId).maybeSingle()).data)
    : (memberships ?? []).some((m: any) => m.role === 'superadmin' && m.club_id === clubId);

  if (!hasAccess) {
    return NextResponse.redirect(
      new URL(isOwner ? '/owner/clubs' : '/select-admin-club', request.url)
    );
  }

  // Dies ist der Weg, über den der Owner in einen fremden Verein wechselt —
  // die weitreichendste Kontextänderung der Plattform und bis hierher
  // unprotokolliert.
  await logAudit({
    actorId: user.id,
    action: 'club_switched',
    resourceType: 'club',
    resourceId: clubId,
    clubId,
    details: { via: isOwner ? 'owner' : 'superadmin' },
    request,
  });

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
