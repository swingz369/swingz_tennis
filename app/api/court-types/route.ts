import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

// GET /api/court-types – Alle Platz-Typen abrufen (öffentlich für authentifizierte)
export async function GET(_req: NextRequest) {
  // No special auth required for reading court types; members can view
  try {
    const courtTypes = await courtService.getCourtTypes();
    return NextResponse.json(courtTypes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching court types:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/court-types – Neuen Platz-Typ erstellen (admin only)
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
      const {
        name,
        description,
        surface_type,
        is_indoor,
        is_outdoor,
        requires_lighting,
        max_players,
        hourly_rate,
      } = body;

      if (!name || !surface_type) {
        return NextResponse.json({ error: 'name and surface_type are required' }, { status: 400 });
      }

      const courtType = await courtService.createCourtType({
        name,
        description,
        surface_type,
        is_indoor: is_indoor ?? false,
        is_outdoor: is_outdoor ?? true,
        requires_lighting: requires_lighting ?? false,
        max_players,
        hourly_rate,
      });

      return NextResponse.json({ success: true, courtType }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating court type:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
