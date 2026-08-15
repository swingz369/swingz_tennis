/**
 * GET /api/rsvps/my – Current member's RSVPs for upcoming sessions
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createClient } from '@/src/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:rsvps:my');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isMember = await verifyRole(auth, 'member');
    if (!isMember) return forbiddenResponse('Zugriff nur für Mitglieder');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const supabase = await createClient();
    const sb = supabase as any;
    const userId = auth.user.id;
    const clubId = auth.clubId;

    try {
      const now = new Date().toISOString();

      const { data: rsvps, error } = await sb
        .from('session_rsvps')
        .select(
          `
          id,
          status,
          responded_at,
          notes,
          session_id,
          sessions!inner (
            id,
            timeslot_start,
            timeslot_end,
            court_id,
            courts ( name ),
            trainer_id,
            trainers ( name ),
            max_participants
          )
        `
        )
        .eq('member_id', userId)
        .eq('club_id', clubId)
        .gte('sessions.timeslot_start', now)
        .order('sessions.timeslot_start', { ascending: true });

      if (error) throw error;

      // Transform to flat structure
      const result = (rsvps || []).map((rsvp: any) => ({
        id: rsvp.id,
        status: rsvp.status,
        respondedAt: rsvp.responded_at,
        notes: rsvp.notes,
        session: rsvp.sessions
          ? {
              id: rsvp.sessions.id,
              timeslotStart: rsvp.sessions.timeslot_start,
              timeslotEnd: rsvp.sessions.timeslot_end,
              courtName: rsvp.sessions.courts?.name || 'Platz',
              trainerName: rsvp.sessions.trainers?.name || 'Trainer',
              maxParticipants: rsvp.sessions.max_participants,
            }
          : null,
      }));

      return NextResponse.json({ rsvps: result });
    } catch (error) {
      log.error('My RSVPs error:', error);
      return internalErrorResponse();
    }
  });
}
