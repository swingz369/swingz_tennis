/**
 * POST /api/sessions/block
 *
 * Admin-only: Block a court slot for events or maintenance.
 * Creates a session with session_type = 'event' or 'maintenance'.
 *
 * Body: {
 *   courtId: string,
 *   date: string (YYYY-MM-DD),
 *   startTime: string (HH:mm),
 *   endTime: string (HH:mm),
 *   clubId: string,
 *   blockType: 'event' | 'maintenance',
 *   reason?: string
 * }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { berlinDateTime } from '@/lib/berlin-time';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions:block');

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const { courtId, date, startTime, endTime, clubId, blockType, reason } = body as {
      courtId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      clubId?: string;
      blockType?: string;
      reason?: string;
    };

    if (!courtId || !date || !startTime || !endTime || !clubId || !blockType) {
      return NextResponse.json(
        { error: 'courtId, date, startTime, endTime, clubId und blockType sind erforderlich' },
        { status: 400 }
      );
    }

    if (blockType !== 'event' && blockType !== 'maintenance') {
      return NextResponse.json(
        { error: 'blockType muss "event" oder "maintenance" sein' },
        { status: 400 }
      );
    }

    // Build timestamps
    const timeslotStart = berlinDateTime(date, startTime);
    const timeslotEnd = berlinDateTime(date, endTime);

    if (isNaN(timeslotStart.getTime()) || isNaN(timeslotEnd.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Datums-/Zeitformat' }, { status: 400 });
    }

    if (timeslotEnd <= timeslotStart) {
      return NextResponse.json({ error: 'endTime muss nach startTime liegen' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // 1. Find the club's active schedule
    const { data: schedule, error: scheduleError } = await serviceClient
      .from('schedules')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Kein aktiver Stundenplan gefunden. Bitte zuerst eine Saison erstellen.' },
        { status: 404 }
      );
    }

    // 2. Calculate ISO week number
    const d = new Date(timeslotStart);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const weekNumber =
      Math.round((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7) + 1;

    // 3. Create blocked session
    const blockLabel = blockType === 'event' ? 'Veranstaltung' : 'Wartung';
    const { data: session, error: sessionError } = await serviceClient
      .from('sessions')
      .insert({
        schedule_id: schedule.id,
        trainer_id: null,
        group_ids: [],
        week_number: weekNumber,
        timeslot_start: timeslotStart.toISOString(),
        timeslot_end: timeslotEnd.toISOString(),
        court_id: courtId,
        max_participants: 1,
        session_type: blockType,
        notes: reason ? `${blockLabel}: ${reason}` : blockLabel,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      log.error('[Sessions Block] Failed to create blocked session:', sessionError);
      if (sessionError?.code === '23P01' || sessionError?.message?.includes('exclusion')) {
        return NextResponse.json(
          { error: 'Dieser Platz ist in diesem Zeitraum bereits belegt' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Sperrung konnte nicht erstellt werden' }, { status: 500 });
    }

    return NextResponse.json(
      {
        sessionId: session.id,
        sessionType: blockType,
        courtId,
        timeslotStart: timeslotStart.toISOString(),
        timeslotEnd: timeslotEnd.toISOString(),
      },
      { status: 201 }
    );
  });
}
