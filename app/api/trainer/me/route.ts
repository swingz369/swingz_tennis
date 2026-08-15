import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { resolveTrainerRecordId } from '@/lib/trainers/trainer-record';

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
      return forbiddenResponse('Zugriff nur für Trainer');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const supabase = await createClient();

    // Auflösung über `trainers.user_id` — dieselbe Verknüpfung, die auch die
    // Saisonplanung und der Admin-Pfad nutzen. Eine Suche über die E-Mail-Adresse
    // bricht, sobald jemand seine Adresse ändert oder zwei Trainerzeilen dieselbe
    // tragen.
    const recordId = await resolveTrainerRecordId(auth.user.id);
    const { data: trainerRecord, error: trainerError } = recordId
      ? await supabase
          .from('trainers')
          .select('id, email, name')
          .eq('id', recordId)
          .eq('is_active', true)
          .maybeSingle()
      : { data: null, error: null };

    if (trainerError || !trainerRecord) {
      return NextResponse.json(
        { error: 'Trainer-Datensatz nicht gefunden. Bitte wende dich an den Administrator.' },
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
      return internalErrorResponse();
    }

    const today = new Date();

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
    // „Diese Woche" ist Montag bis Sonntag der laufenden Woche — nicht „alles ab
    // vor sieben Tagen". Die alte Zählung meldete für eine erst im Oktober
    // beginnende Saison 60 Einheiten „diese Woche".
    const weekStart = new Date(today);
    const weekday = (weekStart.getDay() + 6) % 7; // Montag = 0
    weekStart.setDate(weekStart.getDate() - weekday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sessionsLast7Days = transformedSessions.filter((s) => {
      const start = new Date(s.startTime);
      return start >= weekStart && start < weekEnd;
    }).length;
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
