import { NextRequest, NextResponse } from 'next/server';
import { DrizzleCourtRepository } from '@/infrastructure/persistence/repositories/court.repository';
import { ClubId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const courtRepo = new DrizzleCourtRepository();

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubIdParam = url.searchParams.get('clubId');

    if (!clubIdParam) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clubIdParam)) {
      return NextResponse.json({ error: 'Invalid club ID format' }, { status: 400 });
    }

    try {
      const clubId = ClubId.fromString(clubIdParam);
      const courts = await courtRepo.findByClub(clubId);

      const courtsList = courts.map((c) => ({
        id: c.id,
        name: c.name,
        surface: c.surface,
        hasIndoor: c.hasIndoor,
        isActive: c.isActive,
        clubId: clubId.getValue(),
      }));

      return NextResponse.json(courtsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching courts:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const { name, surface, hasIndoor, isActive, clubId } = body;

      if (!name || !clubId) {
        return NextResponse.json({ error: 'name and clubId are required' }, { status: 400 });
      }

      const court = {
        id: crypto.randomUUID(),
        name,
        surface: surface || 'clay',
        hasIndoor: hasIndoor || false,
        isActive: isActive !== undefined ? isActive : true,
        clubId,
      };

      await courtRepo.save(court);

      return NextResponse.json({ success: true, court }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating court:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
