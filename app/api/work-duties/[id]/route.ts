import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/work-duties/[id] — Get a single work duty with assignments
 * PATCH /api/work-duties/[id] — Update a work duty
 * DELETE /api/work-duties/[id] — Delete a work duty
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const { id } = await params;

    const { data: duty, error } = await (auth.supabase as any)
      .from('work_duties')
      .select('*, work_duty_assignments(id, member_id, status, completed_at)')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (error || !duty) {
      return NextResponse.json({ error: 'Duty not found' }, { status: 404 });
    }

    // Enrich assignments with member names
    const memberIds = (duty.work_duty_assignments ?? [])
      .map((a: any) => a.member_id)
      .filter(Boolean);

    let memberNames: Record<string, string> = {};
    if (memberIds.length > 0) {
      const { data: users } = await auth.supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', memberIds);

      memberNames = Object.fromEntries(
        (users ?? []).map((u) => [u.id, u.full_name ?? u.email ?? 'Unbekannt'])
      );
    }

    const enrichedDuty = {
      ...duty,
      work_duty_assignments: (duty.work_duty_assignments ?? []).map((a: any) => ({
        ...a,
        name: memberNames[a.member_id] ?? 'Unbekannt',
      })),
    };

    return NextResponse.json({ duty: enrichedDuty });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await (auth.supabase as any)
      .from('work_duties')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update duty' }, { status: 500 });
    }

    return NextResponse.json({ duty: data });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;

    const { error } = await (auth.supabase as any)
      .from('work_duties')
      .delete()
      .eq('id', id)
      .eq('club_id', auth.clubId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete duty' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
