import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

const log = createLogger('api:admin:switch-club');

/**
 * POST /api/admin/switch-club
 *
 * Allows superadmin users to switch their active club context (dropdown/picker
 * flow). Owner selects clubs via /owner/clubs → GET /switch-club-redirect instead.
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
      return NextResponse.json({ error: 'clubId ist erforderlich' }, { status: 400 });
    }

    // 3. Verify user is superadmin AND this club is one they actually manage
    // (a real user_club_memberships row with role='superadmin' per assigned
    // club — same shape as an admin's single club membership).
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperadmin = (memberships ?? []).some((m: any) => m.role === 'superadmin');
    if (!isSuperadmin) {
      return NextResponse.json(
        { error: 'Nur Superadmins können Vereine wechseln' },
        { status: 403 }
      );
    }

    const managesClub = (memberships ?? []).some(
      (m: any) => m.role === 'superadmin' && m.club_id === clubId
    );
    if (!managesClub) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Verein' }, { status: 403 });
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

    // Der Vereinswechsel ist der Punkt, an dem ein Superadmin den Datenkontext
    // verlässt, in dem er gerade gearbeitet hat. Die Oberfläche warnt dauerhaft
    // davor — im Protokoll fehlte er bisher komplett.
    await logAudit({
      actorId: user.id,
      action: 'club_switched',
      resourceType: 'club',
      resourceId: clubId,
      clubId,
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Switch Club] Error:', error);
    return internalErrorResponse();
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
      message: 'Vereinsauswahl zurückgesetzt',
    });
  } catch (error) {
    log.error('[Switch Club] Error clearing club:', error);
    return internalErrorResponse();
  }
}
