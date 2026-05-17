import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

interface TransformedSession {
  id: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  attendees: Array<{
    bookingId: string;
    memberName: string;
    status: string;
  }>;
}

export async function GET(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const supabase = await createClient();

    // First, get trainer record from trainers table
    const { data: trainerRecord, error: trainerError } = await supabase
      .from('trainers')
      .select('id, email, name')
      .eq('email', auth.user.email!)
      .eq('is_active', true)
      .single();

    if (trainerError || !trainerRecord) {
      return NextResponse.json(
        { error: 'Trainer record not found. Please contact administrator.' },
        { status: 404 }
      );
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(
        `
        id,
        schedule_id,
        timeslot_start,
        timeslot_end,
        max_participants,
        trainer_id,
        bookings (
          id,
          status,
          member_id
        )
      `
      )
      .eq('trainer_id', trainerRecord.id)
      .order('timeslot_start', { ascending: true });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // For each session, fetch member details for bookings
    const transformedSessions: TransformedSession[] = [];
    for (const s of sessions || []) {
      const attendees = [];
      for (const b of s.bookings || []) {
        // Fetch user details for this booking's member_id
        const { data: userData } = await supabase.auth.admin.getUserById(b.member_id ?? '');
        const memberName =
          userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unbekannt';

        attendees.push({
          bookingId: b.id,
          memberName,
          status: b.status,
        });
      }

      transformedSessions.push({
        id: s.id,
        startTime: s.timeslot_start,
        endTime: s.timeslot_end,
        maxParticipants: s.max_participants,
        attendees,
      });
    }

    const upcomingSessions = transformedSessions.filter(
      (s) => new Date(s.startTime) >= today
    ).length;
    const sessionsLast7Days = transformedSessions.filter(
      (s) => new Date(s.startTime) >= new Date(weekAgo)
    ).length;
    const noShowCount = transformedSessions.reduce(
      (sum, s) => sum + s.attendees.filter((a) => a.status === 'no_show').length,
      0
    );
    const totalAttendees = transformedSessions.reduce((sum, s) => sum + s.attendees.length, 0);

    return NextResponse.json({
      stats: {
        totalSessions: transformedSessions.length,
        upcomingSessions,
        sessionsThisWeek: sessionsLast7Days,
        noShows: noShowCount,
        totalAttendees,
      },
      sessions: transformedSessions,
    });
  });
}
