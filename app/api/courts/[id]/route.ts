/**
 * GET   /api/courts/[id] — Get a single court
 * PATCH /api/courts/[id] — Update a court (admin only)
 *
 * Rewritten to use Supabase client (was broken courtService/Drizzle)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Member access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id: courtId } = await params;

    const { data: court, error } = await auth.supabase
      .from('courts')
      .select(
        'id, club_id, name, number, location, description, status, surface, has_indoor, has_lighting, is_active, created_at'
      )
      .eq('id', courtId)
      .single();

    if (error || !court) {
      return NextResponse.json({ error: 'Court not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: court.id,
      clubId: court.club_id,
      name: court.name,
      surface: court.surface,
      hasIndoor: court.has_indoor,
      hasLighting: court.has_lighting,
      isActive: court.is_active,
      createdAt: court.created_at,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id: courtId } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.surface !== undefined) updates.surface = body.surface;
    if (body.hasIndoor !== undefined) updates.has_indoor = body.hasIndoor;
    if (body.hasLighting !== undefined) updates.has_lighting = body.hasLighting;
    if (body.isActive !== undefined) updates.is_active = body.isActive;

    const { data: court, error } = await auth.supabase
      .from('courts')
      .select(
        'id, club_id, name, number, surface, status, has_indoor, has_lighting, is_active, created_at'
      )
      .eq('id', courtId)
      .single();

    if (error) {
      console.error('[Courts PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Apply updates after reading current state
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await auth.supabase
        .from('courts')
        .update(updates as any)
        .eq('id', courtId);
      if (updateError) {
        console.error('[Courts PATCH update]', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      court: {
        id: court.id,
        name: court.name,
        number: court.number,
        hasLighting: court.has_lighting,
        isActive: court.is_active,
        status: court.status,
      },
    });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const { id: courtId } = await params;

    // Soft delete — set is_active = false
    const { error } = await auth.supabase
      .from('courts')
      .update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', courtId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
