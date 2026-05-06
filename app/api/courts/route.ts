import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ClubId } from '@/domain/value-objects';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
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

      // Use CourtService to get all courts with full details
      const courts = await courtService.getCourtsByClub(clubId.getValue());

      // Map to consistent camelCase response
      const courtsList = courts.map((c) => ({
        id: c.id,
        clubId: c.club_id,
        courtTypeId: c.court_type_id,
        name: c.name,
        number: c.number,
        surface: c.surface,
        location: c.location,
        description: c.description,
        status: c.status,
        hasLighting: c.has_lighting,
        lightingHoursStart: c.lighting_hours_start,
        lightingHoursEnd: c.lighting_hours_end,
        isActive: c.is_active,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
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

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const {
        name,
        courtTypeId,
        number,
        hasLighting,
        lightingHoursStart,
        lightingHoursEnd,
        location,
        description,
        clubId: bodyClubId,
      } = body;

      if (!name || !courtTypeId || number === undefined) {
        return NextResponse.json(
          { error: 'name, courtTypeId, and number are required' },
          { status: 400 }
        );
      }

      // SECURITY FIX: Validate clubId belongs to admin for non-superadmin
      let effectiveClubId: string;
      if (auth.role !== 'superadmin') {
        effectiveClubId = auth.clubId; // Force admin to use their own club
      } else {
        // Superadmin must provide clubId or default to first membership?
        if (!bodyClubId) {
          return NextResponse.json({ error: 'clubId required for superadmin' }, { status: 400 });
        }
        effectiveClubId = bodyClubId;
      }

      // Create court via service
      const court = await courtService.createCourt({
        club_id: effectiveClubId,
        court_type_id: courtTypeId,
        name,
        number,
        location,
        description,
        has_lighting: hasLighting || false,
        lighting_hours_start: lightingHoursStart || null,
        lighting_hours_end: lightingHoursEnd || null,
      });

      return NextResponse.json(
        {
          success: true,
          court: {
            id: court.id,
            clubId: court.club_id,
            courtTypeId: court.court_type_id,
            name: court.name,
            number: court.number,
            surface: court.surface,
            location: court.location,
            description: court.description,
            status: court.status,
            hasLighting: court.has_lighting,
            lightingHoursStart: court.lighting_hours_start,
            lightingHoursEnd: court.lighting_hours_end,
            isActive: court.is_active,
            createdAt: court.created_at,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating court:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
