import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * PATCH /api/weather/closures/[id] — Update a court closure
 * DELETE /api/weather/closures/[id] — Deactivate a court closure
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await (auth.supabase as any)
      .from('court_closures')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update closure' }, { status: 500 });
    }

    return NextResponse.json({ closure: data });
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

    // Soft delete: set is_active = false
    const { error } = await (auth.supabase as any)
      .from('court_closures')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId);

    if (error) {
      return NextResponse.json({ error: 'Failed to deactivate closure' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
