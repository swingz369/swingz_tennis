/**
 * POST /api/bookings/[id]/cancel — Buchung stornieren
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const { id: bookingId } = await params;
    const supabase = auth.supabase;

    // Fetch booking to verify ownership
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, member_id, status, session_start_time, club_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    // Only own bookings or admin
    const isAdmin = await verifyRole(auth, 'admin');
    if (booking.member_id !== auth.user.id && !isAdmin) {
      return forbiddenResponse('Nicht berechtigt diese Buchung zu stornieren');
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Buchung ist bereits storniert' }, { status: 409 });
    }

    // Check cancellation rules
    if (!isAdmin && booking.session_start_time) {
      const { data: rules } = await supabase
        .from('booking_rules')
        .select('cancellation_hours_before')
        .eq('club_id', booking.club_id)
        .eq('applies_to_role', 'member')
        .maybeSingle();

      if (rules?.cancellation_hours_before) {
        const sessionTime = new Date(booking.session_start_time).getTime();
        const hoursUntil = (sessionTime - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < rules.cancellation_hours_before) {
          return NextResponse.json(
            {
              error: `Stornierung nur bis ${rules.cancellation_hours_before}h vor der Session möglich`,
            },
            { status: 409 }
          );
        }
      }
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookingId });
  });
}
