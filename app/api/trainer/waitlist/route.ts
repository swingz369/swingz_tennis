/**
 * POST /api/trainer/waitlist — Mitglied trägt sich auf Warteliste für gebuchten Trainer-Slot ein
 * Body: { slotId: string }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer:waitlist');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission)
      return forbiddenResponse('Nur Mitglieder können sich auf die Warteliste setzen');

    const { supabase, user } = auth;

    const body = await request.json().catch(() => null);
    if (!body?.slotId) {
      return NextResponse.json({ error: 'slotId erforderlich' }, { status: 400 });
    }

    const { slotId } = body as { slotId: string };

    // Verify the slot exists and is actually booked
    const { data: slot, error: slotError } = await supabase
      .from('trainer_availabilities')
      .select('id, status')
      .eq('id', slotId)
      .maybeSingle();

    if (slotError || !slot) {
      return NextResponse.json({ error: 'Slot nicht gefunden' }, { status: 404 });
    }

    if (slot.status !== 'booked') {
      return NextResponse.json(
        { error: 'Slot ist noch verfügbar — bitte direkt buchen' },
        { status: 409 }
      );
    }

    // Use service client for the insert (bypasses RLS for write)
    const serviceClient = createServiceClient();
    const { error: insertError } = await serviceClient
      .from('trainer_slot_waitlist')
      .insert({ slot_id: slotId, user_id: user.id });

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint — already on waitlist
        return NextResponse.json(
          { error: 'Du stehst bereits auf der Warteliste für diesen Slot' },
          { status: 409 }
        );
      }
      log.error('trainer waitlist insert error:', insertError);
      return NextResponse.json({ error: 'Warteliste-Eintrag fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
