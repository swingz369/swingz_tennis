import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:work-duties:[id]:volunteer');

/**
 * POST /api/work-duties/[id]/volunteer — Member self-assigns to an open work duty
 * DELETE /api/work-duties/[id]/volunteer — Member removes themselves from a duty
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const userId = auth.user.id;
    const clubId = auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    // Verify duty exists, belongs to club, and is open for volunteers
    const { data: duty, error: dutyError } = await auth.supabase
      .from('work_duties')
      .select('id, status, max_participants, club_id')
      .eq('id', id)
      .eq('club_id', clubId)
      .single();

    if (dutyError || !duty) {
      return NextResponse.json({ error: 'Dienst nicht gefunden' }, { status: 404 });
    }

    if (duty.status === 'completed' || duty.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Dieser Dienst ist bereits abgeschlossen oder storniert' },
        { status: 400 }
      );
    }

    // Check current assignment count
    const { count } = await auth.supabase
      .from('work_duty_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('duty_id', id);

    const currentCount = count ?? 0;
    if (duty.max_participants !== null && currentCount >= duty.max_participants) {
      return NextResponse.json({ error: 'Alle Plätze sind bereits belegt' }, { status: 400 });
    }

    // Check if already assigned
    const { data: existing } = await auth.supabase
      .from('work_duty_assignments')
      .select('id')
      .eq('duty_id', id)
      .eq('member_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Du bist bereits für diesen Dienst eingetragen' },
        { status: 409 }
      );
    }

    // Assign the member
    const { data: assignment, error: assignError } = await auth.supabase
      .from('work_duty_assignments')
      .insert({
        duty_id: id,
        member_id: userId,
        status: 'assigned',
      })
      .select()
      .single();

    if (assignError) {
      log.error('[Volunteer POST] Error:', assignError);
      return NextResponse.json({ error: 'Fehler beim Eintragen' }, { status: 500 });
    }

    // Update duty status to assigned if it was still open
    if (duty.status === 'open') {
      await auth.supabase
        .from('work_duties')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ assignment }, { status: 201 });
  });
}

/**
 * DELETE — Member removes themselves from a duty
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const userId = auth.user.id;

    // Find and delete the member's own assignment
    const { data: assignment, error: findError } = await auth.supabase
      .from('work_duty_assignments')
      .select('id, status')
      .eq('duty_id', id)
      .eq('member_id', userId)
      .maybeSingle();

    if (findError || !assignment) {
      return NextResponse.json(
        { error: 'Du bist nicht für diesen Dienst eingetragen' },
        { status: 404 }
      );
    }

    if (assignment.status === 'completed') {
      return NextResponse.json(
        { error: 'Abgeschlossene Dienste können nicht mehr storniert werden' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await auth.supabase
      .from('work_duty_assignments')
      .delete()
      .eq('id', assignment.id);

    if (deleteError) {
      log.error('[Volunteer DELETE] Error:', deleteError);
      return NextResponse.json({ error: 'Fehler beim Austragen' }, { status: 500 });
    }

    // Reset duty status to open if no more assignments
    const { count } = await auth.supabase
      .from('work_duty_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('duty_id', id);

    if ((count ?? 0) === 0) {
      await auth.supabase
        .from('work_duties')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ success: true });
  });
}
