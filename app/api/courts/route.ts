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
import { createLogger } from '@/lib/logger';

const log = createLogger('api:courts');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Member access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    // auth.clubId was resolved by withApiAuth → resolveActiveClub, honoring
    // ADMIN_CLUB_COOKIE for superadmin (club-exists) and members/admins (membership).
    // Query ?clubId= still wins for explicit overrides.
    const clubId = url.searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const { data: courts, error } = await auth.supabase
      .from('courts')
      .select(
        'id, club_id, court_type_id, name, number, surface, has_indoor, has_lighting, is_active, usable_for_training, created_at'
      )
      .eq('club_id', clubId)
      .eq('is_active', true)
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
      number: c.number,
      surface: c.surface ?? 'clay',
      location: null,
      description: null,
      status: c.is_active ? 'active' : 'inactive',
      hasLighting: c.has_lighting ?? false,
      hasIndoor: c.has_indoor ?? false,
      isActive: c.is_active ?? true,
      usableForTraining: c.usable_for_training ?? true,
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

    const {
      name,
      hasLighting,
      clubId: bodyClubId,
      isActive,
      usableForTraining,
      courtTypeId,
      number,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!courtTypeId) {
      return NextResponse.json({ error: 'courtTypeId is required' }, { status: 400 });
    }

    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: 'number must be a positive integer' }, { status: 400 });
    }

    // Determine effective clubId. auth.clubId is the cookie-aware resolved club
    // for the caller; body.clubId still wins for superadmin overrides. For
    // non-superadmins, body.clubId is intentionally NOT honored — admin/trainer
    // membership is pinned to exactly one club (or trainers can be cross-club
    // but cannot create courts in clubs they don't manage).
    const effectiveClubId: string | null =
      auth.role === 'superadmin' ? (bodyClubId ?? auth.clubId) : auth.clubId;
    if (!effectiveClubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const { data: court, error } = await auth.supabase
      .from('courts')
      .insert({
        club_id: effectiveClubId,
        court_type_id: courtTypeId,
        name,
        number,
        surface: body.surface ?? 'clay',
        has_indoor: body.hasIndoor ?? false,
        has_lighting: hasLighting ?? false,
        is_active: isActive ?? true,
        usable_for_training: usableForTraining ?? true,
      })
      .select(
        'id, club_id, court_type_id, name, number, location, surface, status, has_indoor, has_lighting, is_active, usable_for_training, created_at'
      )
      .single();

    if (error) {
      log.error('[Courts POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, court }, { status: 201 });
  });
}
