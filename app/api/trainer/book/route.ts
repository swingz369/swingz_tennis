/**
 * POST /api/trainer/book — Member books a trainer slot
 * Body: { trainerId, date, startTime, endTime }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer:book');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const { supabase, user } = auth;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const { trainerId, date, startTime, endTime } = body;
    if (!trainerId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'trainerId, date, startTime, endTime erforderlich' },
        { status: 400 }
      );
    }

    // Find the available slot
    const { data: slot } = await supabase
      .from('trainer_availabilities')
      .select('id, status')
      .eq('trainer_id', trainerId)
      .eq('date', date)
      .eq('start_time', startTime)
      .eq('end_time', endTime)
      .eq('status', 'available')
      .maybeSingle();

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot nicht verfügbar oder bereits gebucht' },
        { status: 409 }
      );
    }

    // Mark slot as booked
    const { error: updateError } = await supabase
      .from('trainer_availabilities')
      .update({ status: 'booked' })
      .eq('id', slot.id);

    if (updateError) {
      log.error('trainer book update error:', updateError);
      return NextResponse.json({ error: 'Buchung fehlgeschlagen' }, { status: 500 });
    }

    // Also create a bookings record for the member
    const { data: club } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    // Create booking entry in bookings table (best-effort)
    // We reuse the existing bookings table with a note referencing trainer slot
    const bookingStart = `${date.split('T')[0]}T${startTime}:00`;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        member_id: user.id,
        status: 'confirmed',
        session_start_time: bookingStart,
        notes: `Trainer-Einzelstunde (slot_id: ${slot.id})`,
        club_id: club?.club_id ?? null,
      } as any)
      .select('id')
      .maybeSingle();

    if (bookingError) {
      log.warn('Could not create bookings record (non-fatal):', bookingError.message);
    }

    return NextResponse.json({ success: true, slotId: slot.id, bookingId: booking?.id ?? null });
  });
}
