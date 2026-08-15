import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * POST /api/work-duties/[id]/assign — Assign member(s) to a work duty
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;
    const body = await request.json();
    const { member_ids } = body;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'member_ids-Array erforderlich' }, { status: 400 });
    }

    // Check duty exists and belongs to club
    const { data: duty } = await (auth.supabase as any)
      .from('work_duties')
      .select('id, max_participants')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (!duty) {
      return NextResponse.json({ error: 'Dienst nicht gefunden' }, { status: 404 });
    }

    // Check current assignment count
    const { count } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('duty_id', id);

    const currentCount = count ?? 0;
    const remainingSlots = duty.max_participants - currentCount;

    if (member_ids.length > remainingSlots) {
      return NextResponse.json(
        { error: `Only ${remainingSlots} slots remaining` },
        { status: 400 }
      );
    }

    // Insert assignments
    const rows = member_ids.map((memberId: string) => ({
      duty_id: id,
      member_id: memberId,
      status: 'assigned',
    }));

    const { data, error } = await (auth.supabase as any)
      .from('work_duty_assignments')
      .insert(rows)
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Mitglied bereits zugewiesen' }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'Mitglieder konnten nicht zugewiesen werden' },
        { status: 500 }
      );
    }

    // Update duty status if fully assigned
    const newTotal = currentCount + member_ids.length;
    if (newTotal >= duty.max_participants) {
      await (auth.supabase as any)
        .from('work_duties')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ assignments: data }, { status: 201 });
  });
}
