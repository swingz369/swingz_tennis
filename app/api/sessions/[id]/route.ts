import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createClient } from '@/src/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions:[id]');

// PATCH /api/sessions/[id] – Session verschieben (Reschedule)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Admins oder Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    const body = await req.json();
    const { courtId, dayOfWeek, startTime, endTime } = body;

    if (!courtId || !dayOfWeek || !startTime) {
      return NextResponse.json(
        { error: 'courtId, dayOfWeek, and startTime are required' },
        { status: 400 }
      );
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(courtId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    try {
      const supabase = await createClient();

      // Fetch the session with club_id for authorization
      const { data: sessionRaw, error: fetchErr } = await supabase
        .from('sessions')
        .select(
          `
          id,
          trainer_id,
          schedule_id,
          timeslot_start,
          timeslot_end,
          court_id,
          club_id
        `
        )
        .eq('id', id)
        .single();
      const session = sessionRaw as {
        id: string;
        trainer_id: string;
        schedule_id: string | null;
        timeslot_start: string;
        timeslot_end: string;
        court_id: string;
        club_id: string;
      } | null;

      if (fetchErr || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Authorization: trainer can only update own sessions; admin can update any in their club
      if (isTrainer && session.trainer_id !== auth.user.id) {
        return forbiddenResponse('Trainer können nur ihre eigenen Sessions ändern');
      }

      // For admin, ensure session belongs to admin's club (unless superadmin)
      if (isAdmin && auth.role !== 'superadmin') {
        if (session.club_id !== auth.clubId) {
          return forbiddenResponse('Session eines anderen Vereins kann nicht geändert werden');
        }
      }

      // Compute new timeslot_start based on dayOfWeek and startTime
      // We need to find the date for the given dayOfWeek in the current week or schedule week
      // The sessions table stores timeslot_start as timestamp; we need to preserve the date portion
      // For simplicity, assume we keep the same week and just change day/time
      const currentStartDate = new Date(session.timeslot_start);
      const currentDayOfWeek = currentStartDate.getDay(); // 0=Sun, 1=Mon, ...
      const dayDiff = dayOfWeek - currentDayOfWeek;
      const newStartDate = new Date(currentStartDate);
      newStartDate.setDate(newStartDate.getDate() + dayDiff);
      newStartDate.setHours(
        parseInt(startTime.split(':')[0]),
        parseInt(startTime.split(':')[1]),
        0,
        0
      );

      // Calculate end time: either provided or same duration as before
      let newEndDate: Date;
      if (endTime) {
        newEndDate = new Date(newStartDate);
        const [endHour, endMin] = endTime.split(':').map(Number);
        newEndDate.setHours(endHour, endMin, 0, 0);
      } else {
        // Preserve duration
        const oldDuration =
          new Date(session.timeslot_end).getTime() - new Date(session.timeslot_start).getTime();
        newEndDate = new Date(newStartDate.getTime() + oldDuration);
      }

      // Optional: Check for conflicts on the new court and timeslot
      const { data: conflicts } = await supabase
        .from('sessions')
        .select('id')
        .eq('court_id', courtId)
        .gte('timeslot_start', newStartDate.toISOString())
        .lt('timeslot_start', newEndDate.toISOString())
        .neq('id', id)
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          {
            error: 'Time slot conflict: another session exists at this time on the selected court',
          },
          { status: 409 }
        );
      }

      // Perform update
      const { data: updated, error: updateErr } = await supabase
        .from('sessions')
        .update({
          court_id: courtId,
          timeslot_start: newStartDate.toISOString(),
          timeslot_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(
          `
          id,
          trainer_id,
          schedule_id,
          timeslot_start,
          timeslot_end,
          court_id,
          club_id
        `
        )
        .single();

      if (updateErr) {
        log.error('Session update error:', updateErr);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      return NextResponse.json({ success: true, session: updated });
    } catch (error) {
      log.error('Error updating session:', error);
      return internalErrorResponse();
    }
  });
}

// DELETE /api/sessions/[id] – Delete a session
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Zugriff nur für Admins oder Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    try {
      const supabase = await createClient();

      // Fetch the session to check permissions
      const { data: sessionRaw2, error: fetchErr } = await (supabase as any)
        .from('sessions')
        .select('id, trainer_id, club_id')
        .eq('id', id)
        .single();
      const session = sessionRaw2 as { id: string; trainer_id: string; club_id: string } | null;

      if (fetchErr || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Authorization: trainer can only delete own sessions; admin can delete any in their club
      if (isTrainer && session.trainer_id !== auth.user.id) {
        return forbiddenResponse('Trainer können nur ihre eigenen Sessions löschen');
      }

      // For admin, ensure session belongs to admin's club (unless superadmin)
      if (isAdmin && auth.role !== 'superadmin') {
        if (session.club_id !== auth.clubId) {
          return forbiddenResponse('Session eines anderen Vereins kann nicht gelöscht werden');
        }
      }

      // Delete the session
      const { error: deleteErr } = await supabase.from('sessions').delete().eq('id', id);

      if (deleteErr) {
        log.error('Session delete error:', deleteErr);
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Error deleting session:', error);
      return internalErrorResponse();
    }
  });
}
