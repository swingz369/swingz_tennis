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
    console.error('Error fetching court types:', error);
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
      console.error('Error creating court type:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// PATCH /api/court-types/[id] – Platz-Typ aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const id = params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

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
        is_active,
      } = body;

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (surface_type !== undefined) updates.surface_type = surface_type;
      if (is_indoor !== undefined) updates.is_indoor = is_indoor;
      if (is_outdoor !== undefined) updates.is_outdoor = is_outdoor;
      if (requires_lighting !== undefined) updates.requires_lighting = requires_lighting;
      if (max_players !== undefined) updates.max_players = max_players;
      if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate;
      if (is_active !== undefined) updates.is_active = is_active;

      const courtType = await courtService.updateCourtType(id, updates);
      if (!courtType) {
        return NextResponse.json(
          { error: 'Court type not found or update failed' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, courtType });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating court type:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// DELETE /api/court-types/[id] – Platz-Typ löschen (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const id = params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    try {
      // Check if any courts reference this type
      const { data: refCount, error: refError } = await courtService.supabase
        .from('courts')
        .select('id', { count: 'exact', head: true })
        .eq('court_type_id', id);

      if (refError) {
        console.error('Error checking court type references:', refError);
      } else if (refCount && refCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete court type: ${refCount} court(s) are using this type` },
          { status: 409 }
        );
      }

      const result = await courtService.deleteCourtType(id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.message || 'Failed to delete court type' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: 'Court type deactivated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting court type:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
