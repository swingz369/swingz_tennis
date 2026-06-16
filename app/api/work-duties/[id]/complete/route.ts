import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:work-duties:[id]:complete');

/**
 * POST /api/work-duties/[id]/complete — Member marks their assignment as completed
 * PATCH /api/work-duties/[id]/complete — Admin confirms all assignments as completed
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const userId = auth.user.id;

    // Find the member's own assignment
    const { data: assignment, error: findError } = await (auth.supabase as any)
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
      return NextResponse.json({ error: 'Bereits als erledigt markiert' }, { status: 400 });
    }

    // Mark assignment as completed
    const { error: updateError } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) {
      log.error('[Complete POST] Error:', updateError);
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
    }

    // Check if all assignments for this duty are completed
    const { data: allAssignments } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .select('status')
      .eq('duty_id', id);

    const allCompleted = (allAssignments ?? []).every(
      (a: { status: string }) => a.status === 'completed'
    );

    // If all assignments completed, mark the duty as completed
    if (allCompleted && (allAssignments ?? []).length > 0) {
      await (auth.supabase as any)
        .from('work_duties')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, allCompleted });
  });
}

/**
 * PATCH — Admin confirms/rejects completion for an assignment
 * Body: { assignment_id, action: 'confirm' | 'reject' }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin-Zugriff erforderlich');

    const { id } = await params;
    const body = await request.json();
    const { assignment_id, action } = body;

    if (!assignment_id || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'assignment_id und action erforderlich' }, { status: 400 });
    }

    // Verify duty belongs to club
    const { data: duty } = await (auth.supabase as any)
      .from('work_duties')
      .select('id')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (!duty) {
      return NextResponse.json({ error: 'Dienst nicht gefunden' }, { status: 404 });
    }

    if (action === 'confirm') {
      // Verify assignment belongs to this duty
      const { data: target } = await (auth.supabase as any)
        .from('work_duty_assignments')
        .select('id')
        .eq('id', assignment_id)
        .eq('duty_id', id)
        .maybeSingle();

      if (!target) {
        return NextResponse.json({ error: 'Zuweisung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Bestätigt' });
    }

    // Reject — reset to assigned (verify assignment belongs to this duty)
    const { error } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .update({ status: 'assigned', completed_at: null })
      .eq('id', assignment_id)
      .eq('duty_id', id);

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Ablehnen' }, { status: 500 });
    }

    // If duty was completed, reopen it
    await (auth.supabase as any)
      .from('work_duties')
      .update({ status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'completed');

    return NextResponse.json({ success: true, message: 'Abgelehnt — zurückgesetzt' });
  });
}
