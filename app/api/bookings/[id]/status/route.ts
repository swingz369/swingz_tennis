/**
 * PATCH /api/bookings/[id]/status — Buchungsstatus ändern (Admin/Trainer)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isTrainer) return forbiddenResponse('Trainer oder Admin Zugriff erforderlich');

    const { id: bookingId } = await params;
    const body = await req.json().catch(() => null);

    if (!body?.status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase
      .from('bookings')
      .update({ status: body.status })
      .eq('id', bookingId);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true, bookingId, status: body.status });
  });
}
