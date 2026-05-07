/**
 * DELETE /api/trainer/availability/[id] — remove slot
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Only trainers can delete availability');

    const { supabase, user } = auth;
    const { id } = await params;

    // Fetch slot to check ownership
    const { data: slot } = await supabase
      .from('trainer_availabilities')
      .select('id, trainer_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!slot) {
      return NextResponse.json({ error: 'Slot nicht gefunden' }, { status: 404 });
    }

    // Only own slots; admins/superadmins can delete any
    const isOwner = slot.trainer_id === user.id;
    const isAdminLike = auth.role === 'admin' || auth.role === 'superadmin';

    if (!isOwner && !isAdminLike) {
      return forbiddenResponse("Cannot delete another trainer's slot");
    }

    if (slot.status === 'booked') {
      return NextResponse.json(
        { error: 'Gebuchter Slot kann nicht gelöscht werden' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('trainer_availabilities').delete().eq('id', id);

    if (error) {
      console.error('trainer availability DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
