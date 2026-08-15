/**
 * GET   /api/courts/[id] — Get a single court
 * PATCH /api/courts/[id] — Update a court (admin only)
 *
 * Rewritten to use Supabase client (was broken courtService/Drizzle)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:courts:[id]');

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Mitglieder');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id: courtId } = await params;

    const { data: court, error } = await auth.supabase
      .from('courts')
      .select(
        'id, club_id, name, number, location, description, status, surface, has_indoor, has_lighting, is_active, usable_for_training, created_at'
      )
      .eq('id', courtId)
      .single();

    if (error || !court) {
      return NextResponse.json({ error: 'Platz nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({
      id: court.id,
      clubId: court.club_id,
      name: court.name,
      surface: court.surface,
      hasIndoor: court.has_indoor,
      hasLighting: court.has_lighting,
      isActive: court.is_active,
      usableForTraining: court.usable_for_training,
      createdAt: court.created_at,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id: courtId } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.surface !== undefined) updates.surface = body.surface;
    if (body.hasIndoor !== undefined) updates.has_indoor = body.hasIndoor;
    if (body.hasLighting !== undefined) updates.has_lighting = body.hasLighting;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.usableForTraining !== undefined) updates.usable_for_training = body.usableForTraining;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 });
    }

    const { data: court, error } = await auth.supabase
      .from('courts')
      .update(updates as any)
      .eq('id', courtId)
      .select(
        'id, club_id, court_type_id, name, number, surface, status, has_indoor, has_lighting, is_active, usable_for_training, created_at'
      )
      .single();

    if (error) {
      log.error('[Courts PATCH]', error);
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true, court });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const { id: courtId } = await params;

    // Soft delete — set is_active = false
    const { error } = await auth.supabase
      .from('courts')
      .update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', courtId);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}
