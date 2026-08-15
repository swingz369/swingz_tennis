import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * DELETE /api/work-duties/[id]/assign/[assignmentId] — Remove a member assignment from a work duty
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id, assignmentId } = await params;

    // Verify the duty belongs to the club
    const { data: duty } = await (auth.supabase as any)
      .from('work_duties')
      .select('id')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (!duty) {
      return NextResponse.json({ error: 'Duty not found' }, { status: 404 });
    }

    const { error } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('duty_id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
