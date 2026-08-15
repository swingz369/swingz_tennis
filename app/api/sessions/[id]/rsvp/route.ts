/**
 * RSVP API for training sessions.
 *
 * POST /api/sessions/[id]/rsvp – Member submits RSVP (accepted/declined/maybe)
 * GET  /api/sessions/[id]/rsvp – Trainer/Admin sees RSVPs for a session
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createClient } from '@/src/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { getSessionParticipants } from '@/lib/session-participants';

const log = createLogger('api:sessions:[id]:rsvp');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isMember = await verifyRole(auth, 'member');
    if (!isMember) return forbiddenResponse('Zugriff nur für Mitglieder');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id: sessionId } = await params;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Ungültige Session-ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const status = body?.status as string;

    if (!status || !['accepted', 'declined', 'maybe'].includes(status)) {
      return NextResponse.json(
        { error: 'status muss einer sein von: accepted, declined, maybe' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const sb = supabase as any;
    const userId = auth.user.id;
    const clubId = auth.clubId;

    try {
      // Verify the session exists
      const { data: session } = await supabase
        .from('sessions')
        .select('id, timeslot_start')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
      }

      // Upsert RSVP (insert or update)
      const { data: existing } = await sb
        .from('session_rsvps')
        .select('id')
        .eq('session_id', sessionId)
        .eq('member_id', userId)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await sb
          .from('session_rsvps')
          .update({
            status,
            responded_at: new Date().toISOString(),
            notes: body?.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await sb
          .from('session_rsvps')
          .insert({
            session_id: sessionId,
            member_id: userId,
            club_id: clubId,
            status,
            responded_at: new Date().toISOString(),
            notes: body?.notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return NextResponse.json({ rsvp: result });
    } catch (error) {
      log.error('RSVP error:', error);
      return internalErrorResponse();
    }
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isTrainerOrAdmin = await verifyRole(auth, 'trainer');
    if (!isTrainerOrAdmin) return forbiddenResponse('Zugriff nur für Trainer oder Admins');

    const { id: sessionId } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Ungültige Session-ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const sb = supabase as any;

    try {
      // Herleitung siehe lib/session-participants.ts — dort steht die einzige
      // Stelle, an der aus einer Einheit eine Teilnehmerliste wird.
      const rsvps = await getSessionParticipants(sb, sessionId);
      return NextResponse.json({ rsvps });
    } catch (error) {
      log.error('RSVP GET error:', error);
      return internalErrorResponse();
    }
  });
}
