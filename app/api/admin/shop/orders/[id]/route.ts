/**
 * PATCH /api/admin/shop/orders/[id]
 *
 * Updates the fulfillment status of a shop order.
 * Valid transitions: pending → confirmed → shipped
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  shipped: 'Versendet',
  cancelled: 'Storniert',
};

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const { id } = await params;
    const sb = auth.supabase;

    let body: { status?: string };
    try {
      body = await _request.json();
    } catch {
      return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
    }

    const newStatus = body.status;
    if (!newStatus) {
      return NextResponse.json({ error: 'Status erforderlich' }, { status: 400 });
    }

    // Fetch current order
    const { data: order, error: fetchError } = await sb
      .from('shop_orders')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    // Vereinszugehörigkeit prüft RLS (club_id, is_club_admin) — fremde Bestellungen sind 404.

    const currentStatus = order.status as string;

    // Validate transition
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedNext) {
      return NextResponse.json(
        {
          error: `Status „${STATUS_LABELS[currentStatus] || currentStatus}“ kann nicht mehr geändert werden`,
        },
        { status: 400 }
      );
    }

    if (!allowedNext.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Übergang von „${STATUS_LABELS[currentStatus] || currentStatus}“ zu „${STATUS_LABELS[newStatus] || newStatus}“ ist nicht erlaubt`,
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await sb
      .from('shop_orders')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return internalErrorResponse();
    }

    return NextResponse.json({ order: updated });
  });
}
