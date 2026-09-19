/**
 * POST /api/sessions/ad-hoc
 *
 * Admin/Trainer: Eine zusätzliche, einmalige Trainingseinheit außerhalb der
 * Saisonplanung eintragen (session_type = 'training', plan_entry_id = null).
 * Der trainer_id wird serverseitig aus der eigenen Trainer-Zuordnung
 * (trainers.user_id) aufgelöst — niemals vom Client übernommen, damit ein
 * Trainer keine Einheit unter fremdem Namen anlegen kann.
 *
 * Body: {
 *   courtId: string,
 *   date: string (YYYY-MM-DD),
 *   startTime: string (HH:mm),
 *   endTime: string (HH:mm),
 *   clubId: string,
 *   maxParticipants?: number,
 *   notes?: string
 * }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { berlinDateTime } from '@/lib/berlin-time';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions:ad-hoc');

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isPrivileged = await verifyRole(auth, 'trainer');
    if (!isPrivileged) return forbiddenResponse('Trainer- oder Admin-Zugriff erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const { courtId, date, startTime, endTime, clubId, maxParticipants, notes } = body as {
      courtId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      clubId?: string;
      maxParticipants?: number;
      notes?: string;
    };

    if (!courtId || !date || !startTime || !endTime || !clubId) {
      return NextResponse.json(
        { error: 'courtId, date, startTime, endTime und clubId sind erforderlich' },
        { status: 400 }
      );
    }

    const timeslotStart = berlinDateTime(date, startTime);
    const timeslotEnd = berlinDateTime(date, endTime);

    if (isNaN(timeslotStart.getTime()) || isNaN(timeslotEnd.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Datums-/Zeitformat' }, { status: 400 });
    }

    if (timeslotEnd <= timeslotStart) {
      return NextResponse.json({ error: 'endTime muss nach startTime liegen' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // trainer_id serverseitig auflösen — nie vom Client übernehmen
    const { data: trainerRec } = await serviceClient
      .from('trainers')
      .select('id')
      .eq('user_id', auth.user.id)
      .maybeSingle();

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

    const d = new Date(timeslotStart);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const weekNumber =
      Math.round((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7) + 1;

    const { data: session, error: sessionError } = await serviceClient
      .from('sessions')
      .insert({
        schedule_id: schedule.id,
        trainer_id: trainerRec?.id ?? null,
        group_ids: [],
        week_number: weekNumber,
        timeslot_start: timeslotStart.toISOString(),
        timeslot_end: timeslotEnd.toISOString(),
        court_id: courtId,
        max_participants: maxParticipants && maxParticipants > 0 ? maxParticipants : 4,
        session_type: 'training',
        notes: notes || null,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      log.error('[Sessions Ad-hoc] Failed to create session:', sessionError);
      if (sessionError?.code === '23P01' || sessionError?.message?.includes('exclusion')) {
        return NextResponse.json(
          { error: 'Dieser Platz ist in diesem Zeitraum bereits belegt' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Einheit konnte nicht erstellt werden' }, { status: 500 });
    }

    return NextResponse.json(
      {
        sessionId: session.id,
        courtId,
        timeslotStart: timeslotStart.toISOString(),
        timeslotEnd: timeslotEnd.toISOString(),
      },
      { status: 201 }
    );
  });
}
