import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createClient } from '@/infrastructure/external/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:court-types:[id]');

// PATCH /api/court-types/[id] – Platz-Typ aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Ungültiges ID-Format' }, { status: 400 });
    }

    // 404 statt 400: ein fremder Platztyp soll sich nicht von einem nicht
    // existierenden unterscheiden lassen.
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Platztyp nicht gefunden' }, { status: 404 });
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

      const courtType = await courtService.updateCourtType(id, auth.clubId, updates);
      if (!courtType) {
        return NextResponse.json(
          { error: 'Platztyp nicht gefunden oder Update fehlgeschlagen' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, courtType });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error updating court type:', message);
      return internalErrorResponse();
    }
  });
}

// DELETE /api/court-types/[id] – Platz-Typ löschen (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Ungültiges ID-Format' }, { status: 400 });
    }

    // 404 statt 400: ein fremder Platztyp soll sich nicht von einem nicht
    // existierenden unterscheiden lassen.
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Platztyp nicht gefunden' }, { status: 404 });
    }

    try {
      // Check if any courts reference this type
      const supabase = await createClient();
      const { count, error: refError } = await supabase
        .from('courts')
        .select('id', { count: 'exact', head: true })
        .eq('court_type_id', id);

      if (refError) {
        log.error('Error checking court type references:', refError);
      } else if (count && count > 0) {
        return NextResponse.json(
          { error: `Cannot delete court type: ${count} court(s) are using this type` },
          { status: 409 }
        );
      }

      const result = await courtService.deleteCourtType(id, auth.clubId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.message || 'Failed to delete court type' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: 'Platztyp deaktiviert' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error deleting court type:', message);
      return internalErrorResponse();
    }
  });
}
