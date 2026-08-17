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
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }
    const body = await request.json();

    const { data, error } = await auth.supabase
      .from('court_closures')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Sperre konnte nicht aktualisiert werden' },
        { status: 500 }
      );
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
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    // Soft delete: set is_active = false
    const { error } = await auth.supabase
      .from('court_closures')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId);

    if (error) {
      return NextResponse.json(
        { error: 'Sperre konnte nicht deaktiviert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
