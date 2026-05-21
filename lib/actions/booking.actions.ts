// lib/actions/booking.actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/guards';
import { createBookingSchema, type CreateBookingInput } from '@/lib/schemas/booking.schema';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createBookingAction(
  input: CreateBookingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Server-seitige Auth-Prüfung (IMMER!)
    const user = await getAuthenticatedUser();

    // 2. Server-seitige Validierung (IMMER! Client kann manipuliert werden)
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Ungültige Eingabe',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { courtId, startTime, endTime, notes } = parsed.data;

    // Create Supabase client
    const supabase = await createClient();

    // 3. Court existiert und ist aktiv? Gib auch club_id zurück
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .select('id, club_id, is_active')
      .eq('id', courtId)
      .single();

    if (courtError || !court || !court.is_active) {
      return { success: false, error: 'Platz nicht verfügbar.' };
    }

    // 4. Booking erstellen – Doppelbuchungs-Constraint wirft Fehler wenn verletzt
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        club_id: court.club_id, // Vom Court übernehmen
        court_id: courtId,
        user_id: user.id,
        start_time: startTime,
        end_time: endTime,
        notes: notes ?? null,
        status: 'confirmed',
      } as any)
      .select('id')
      .single();

    if (bookingError) {
      // Doppelbuchungs-Fehler erkennen
      if (bookingError.code === '23P01') {
        // exclusion_violation
        return {
          success: false,
          error: 'Dieser Platz ist im gewählten Zeitraum bereits gebucht.',
        };
      }
      console.error('Booking error:', bookingError);
      return { success: false, error: 'Buchung konnte nicht erstellt werden.' };
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/admin/bookings');

    return { success: true, data: { id: booking.id } };
  } catch (error) {
    console.error('Unexpected error in createBookingAction:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createClient();

    // Buchung holen
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, start_time, status')
      .eq('id', bookingId)
      .single() as any;

    if (fetchError || !booking) {
      return { success: false, error: 'Buchung nicht gefunden.' };
    }

    // Nur eigene Buchungen oder Admin
    const isOwner = booking.user_id === user.id;
    const isAdmin = ['admin', 'superadmin'].includes(user.role);

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Keine Berechtigung.' };
    }

    // Buchung liegt in der Vergangenheit?
    if (new Date(booking.start_time) < new Date() && !isAdmin) {
      return { success: false, error: 'Vergangene Buchungen können nicht storniert werden.' };
    }

    // Bereits storniert?
    if (booking.status === 'cancelled') {
      return { success: false, error: 'Buchung ist bereits storniert.' };
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (updateError) {
      return { success: false, error: 'Stornierung fehlgeschlagen.' };
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/admin/bookings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in cancelBookingAction:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}
