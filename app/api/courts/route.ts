/**
 * GET  /api/courts?clubId=xxx — Returns all courts for a club
 * POST /api/courts             — Creates a new court (admin only)
 *
 * Rewritten to use Supabase client directly (was using broken courtService/Drizzle)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:courts');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Member access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    let clubId = url.searchParams.get('clubId');

    // If no clubId in query, use from auth context
    if (!clubId) {
      if (auth.role === 'superadmin') {
        const cookieClubId = req.cookies.get(ADMIN_CLUB_COOKIE)?.value;
        if (!cookieClubId) {
          return NextResponse.json({ error: 'clubId required' }, { status: 400 });
        }
        clubId = cookieClubId;
      } else {
        clubId = auth.clubId;
      }
    }

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const { data: courts, error } = await auth.supabase
      .from('courts')
      .select(
        'id, club_id, court_type_id, name, surface, has_indoor, has_lighting, is_active, created_at'
      )
      .eq('club_id', clubId)
      .order('name', { ascending: true });

    if (error) {
      log.error('[Courts GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const courtsList = (courts ?? []).map((c: any) => ({
      id: c.id,
      clubId: c.club_id,
      courtTypeId: c.court_type_id,
      name: c.name,
      number: null,
      surface: c.surface ?? 'clay',
      location: null,
      description: null,
      status: c.is_active ? 'active' : 'inactive',
      hasLighting: c.has_lighting ?? false,
      hasIndoor: c.has_indoor ?? false,
      isActive: c.is_active ?? true,
      createdAt: c.created_at,
    }));

    return NextResponse.json(courtsList);
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { name, hasLighting, clubId: bodyClubId, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Determine effective clubId
    let effectiveClubId: string | null = null;
    if (auth.role === 'superadmin') {
      effectiveClubId = bodyClubId || req.cookies.get(ADMIN_CLUB_COOKIE)?.value || null;
      if (!effectiveClubId) {
        return NextResponse.json({ error: 'clubId required for superadmin' }, { status: 400 });
      }
    } else {
      effectiveClubId = auth.clubId;
    }

    if (!effectiveClubId) {
      return NextResponse.json({ error: 'No club context' }, { status: 400 });
    }

    const { data: court, error } = await auth.supabase
      .from('courts')
      .insert({
        club_id: effectiveClubId,
        name,
        surface: body.surface ?? 'clay',
        has_indoor: body.hasIndoor ?? false,
        has_lighting: hasLighting ?? false,
        is_active: isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      log.error('[Courts POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        court: {
          id: court.id,
          clubId: court.club_id,
          name: court.name,
          number: court.number,
          location: court.location,
          hasLighting: court.has_lighting,
          isActive: court.is_active,
          status: court.status,
          createdAt: court.created_at,
        },
      },
      { status: 201 }
    );
  });
}
