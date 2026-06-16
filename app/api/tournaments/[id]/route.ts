/**
 * GET    /api/tournaments/[id] — single tournament with registrations + user names
 * PATCH  /api/tournaments/[id] — update tournament (admin only)
 * DELETE /api/tournaments/[id] — delete tournament (admin only)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tournaments:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const { supabase } = auth;
    const { id } = await params;

    // Fetch tournament
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (tError || !tournament) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 });
    }

    // Fetch registrations with user info
    const { data: registrations, error: rError } = await supabase
      .from('tournament_registrations')
      .select(
        `id, tournament_id, user_id, status, payment_status, registration_date, notes, seed,
         users:user_id ( id, email, full_name )`
      )
      .eq('tournament_id', id)
      .order('registration_date', { ascending: true });

    if (rError) {
      log.error('tournament registrations fetch error:', rError);
    }

    return NextResponse.json({
      tournament,
      registrations: registrations ?? [],
      participantCount: (registrations ?? []).length,
    });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    const { supabase } = auth;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    // Build update payload — only allowed fields
    const allowedFields = [
      'name',
      'description',
      'format',
      'category',
      'surface',
      'max_participants',
      'registration_deadline',
      'start_date',
      'end_date',
      'status',
      'prize_info',
      'entry_fee',
    ] as const;

    const updateData: { [key: string]: unknown } = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('tournament PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update tournament' }, { status: 500 });
    }

    return NextResponse.json({ tournament });
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    const { supabase } = auth;
    const { id } = await params;

    // First delete all registrations for this tournament
    await supabase.from('tournament_registrations').delete().eq('tournament_id', id);

    const { error } = await supabase.from('tournaments').delete().eq('id', id);

    if (error) {
      log.error('tournament DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
