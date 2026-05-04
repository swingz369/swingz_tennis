import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

interface BookingMember {
  full_name: string | null;
  email: string | null;
}

interface Booking {
  id: string;
  status: string;
  member: BookingMember;
}

interface Session {
  id: string;
  schedule_id: string | null;
  timeslot_start: string;
  timeslot_end: string;
  max_participants: number;
  trainer_id: string;
  bookings: Booking[];
}

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
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');
  if (hasDemoMode) {
    return NextResponse.json({
      stats: {
        totalSessions: 3,
        upcomingSessions: 2,
        sessionsThisWeek: 2,
        noShows: 1,
        totalAttendees: 12,
      },
      sessions: [
        {
          id: 'demo-session-1',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          maxParticipants: 4,
          attendees: [
            { bookingId: 'b1', memberName: 'Demo Member 1', status: 'confirmed' },
            { bookingId: 'b2', memberName: 'Demo Member 2', status: 'pending' },
          ],
        },
      ],
    });
  }

  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    const supabase = await createClient();

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
          member:users!inner(full_name, email)
        )
      `
      )
      .eq('trainer_id', auth.user.id)
      .order('timeslot_start', { ascending: true });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const transformedSessions: TransformedSession[] = (sessions || []).map((s: Session) => ({
      id: s.id,
      startTime: s.timeslot_start,
      endTime: s.timeslot_end,
      maxParticipants: s.max_participants,
      attendees: (s.bookings || []).map((b: Booking) => ({
        bookingId: b.id,
        memberName: b.member?.full_name || b.member?.email || 'Unbekannt',
        status: b.status,
      })),
    }));

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
