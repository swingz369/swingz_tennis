/**
 * DELETE /api/trainer/availability/[id] — remove slot
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { resolveTrainerRecordId } from '@/lib/trainers/trainer-record';

const log = createLogger('api:trainer:availability:[id]');

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

    // slot.trainer_id ist eine trainers.id, user.id eine users.id — beide sind
    // nur bei Legacy-Zeilen identisch. Ohne Auflösung konnte ein Trainer seinen
    // eigenen Slot nicht löschen (siehe lib/trainers/trainer-record.ts).
    const ownRecordId = await resolveTrainerRecordId(user.id);
    const isOwner = ownRecordId !== null && slot.trainer_id === ownRecordId;
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
      log.error('trainer availability DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
