import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import {
  ReminderService,
  type Session,
  type Booking,
  type ISessionRepository,
  type IBookingRepository,
  type IMemberRepository,
} from '@/application/use-cases/send-reminders.use-case';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { pushNotificationService } from '@/lib/push-notification.service';
import { sendRemindersSchema } from '@/application/validation/schemas/reminders.schema';
import { createLogger } from '@/lib/logger';
import { recordHeartbeat } from '@/lib/ops-heartbeat';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

const log = createLogger('api:reminders:booking-tomorrow');

export const dynamic = 'force-dynamic';

class TempSessionRepository implements ISessionRepository {
  constructor(private readonly cron: boolean) {}

  async findSessionsForDateRange(startDate: Date, endDate: Date): Promise<Session[]> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    // Vercel-Cron hat keine Nutzer-Session. Der normale Client sieht wegen
    // RLS keine Vereins-Termine; der signierte Cron liest systemweit.
    const supabase = this.cron ? createServiceClient() : await createClient();
    const { data, error } = await supabase
      .from('sessions')
      .select('*, trainers(name, email), courts(name), schedules(clubs(name))')
      .gte('timeslot_start', startDate.toISOString())
      .lte('timeslot_end', endDate.toISOString());
    if (error) {
      throw new Error(`Failed to load sessions: ${error.message}`);
    }
    return (data || []).map((session): Session => {
      const trainer = (Array.isArray(session.trainers) ? session.trainers[0] : session.trainers) as
        { name: string; email?: string } | undefined;
      const court = (Array.isArray(session.courts) ? session.courts[0] : session.courts) as
        { name: string } | undefined;
      const club = session.schedules?.clubs as { name: string } | null | undefined;
      return {
        id: session.id,
        timeslot_start: session.timeslot_start,
        timeslot_end: session.timeslot_end,
        trainer_id: session.trainer_id ?? '',
        court_id: session.court_id ?? null,
        trainers: trainer ? { name: trainer.name, email: trainer.email ?? undefined } : undefined,
        courts: court ? { name: court.name } : undefined,
        clubs: club ? { name: club.name } : undefined,
      };
    });
  }
}

class TempBookingRepository implements IBookingRepository {
  constructor(private readonly cron: boolean) {}

  async findConfirmedBookingsForSessions(sessionIds: string[]): Promise<Booking[]> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = this.cron ? createServiceClient() : await createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('id, member_id, session_id, status')
      .in('session_id', sessionIds)
      .eq('status', 'confirmed');
    if (error) {
      throw new Error(`Failed to load bookings: ${error.message}`);
    }
    return (data || []).map((booking): Booking => ({
      id: booking.id,
      member_id: booking.member_id ?? '',
      session_id: booking.session_id ?? '',
      status: booking.status ?? '',
    }));
  }
}

class TempMemberRepository implements IMemberRepository {
  constructor(private readonly cron: boolean) {}

  async findMemberById(memberId: string): Promise<{ email: string; full_name: string } | null> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = this.cron ? createServiceClient() : await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', memberId)
      .single();
    if (error) {
      throw new Error(`Failed to load member ${memberId}: ${error.message}`);
    }
    if (!data) return null;
    return { email: data.email ?? '', full_name: data.full_name ?? '' };
  }
}

/**
 * Gemeinsame Ausführung für Cron (GET) und manuellen Admin-Trigger (POST):
 * baut den ReminderService, verschickt die Erinnerungen für morgen, feuert
 * Push-Benachrichtigungen ab und schreibt das Lebenszeichen.
 *
 * dryRun=true verschickt nichts und schreibt kein Heartbeat — ein Trockenlauf
 * zählt nicht als gelaufener Job (Kommentar unten).
 */
async function runReminders(dryRun: boolean, cron = false) {
  const reminderService = new ReminderService(
    new EmailService(),
    new AuditServiceImpl(),
    new TempSessionRepository(cron),
    new TempBookingRepository(cron),
    new TempMemberRepository(cron)
  );

  const results = await reminderService.sendTomorrowReminders({ dryRun });

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  // Fire-and-forget: send push notifications for each successful reminder
  const sentResults = results.filter((r) => r.status === 'sent');
  for (const r of sentResults) {
    const time = new Date(r.sessionStart).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const court = r.courtName || 'Platz';
    pushNotificationService
      .sendToUser(r.memberId, {
        title: 'Training morgen',
        body: `${time} Uhr — ${court}${r.trainerName ? ` mit ${r.trainerName}` : ''}`,
        url: '/bookings',
        tag: `reminder-${r.sessionId}`,
      })
      .catch(() => {
        /* non-blocking */
      });
  }

  // Lebenszeichen fuer /api/health (PRODUKTIONSREIFE.md 5.3). Ein
  // Trockenlauf zaehlt nicht — sonst sieht die Ueberwachung einen Job als
  // gelaufen, der nichts verschickt hat.
  if (!dryRun) await recordHeartbeat('cron-booking-reminders');

  return {
    total: results.length,
    sent: sentCount,
    failed: failedCount,
    results: results.slice(0, 50),
  };
}

/**
 * GET /api/reminders/booking-tomorrow
 *
 * Vercel-Cron-Einstieg (vercel.json: `0 18 * * *`). Vercel ruft Cron-Jobs
 * per GET mit `Authorization: Bearer <CRON_SECRET>` auf — deshalb GET und
 * CRON_SECRET-Auth statt Admin-Session. Der manuelle Admin-Trigger bleibt
 * POST (mit dryRun) darunter.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Dienst fehlkonfiguriert' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { total, sent, failed, results } = await runReminders(false, true);
    return NextResponse.json({
      success: true,
      dryRun: false,
      total,
      sent,
      failed,
      results,
    });
  } catch (error) {
    log.error('Error sending reminders (cron):', error);
    return internalErrorResponse();
  }
}

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const input = sendRemindersSchema.parse(body);

      const { total, sent, failed, results } = await runReminders(input.dryRun);

      return NextResponse.json({
        success: true,
        dryRun: input.dryRun,
        total,
        sent,
        failed,
        results,
      });
    } catch (error) {
      log.error('Error sending reminders:', error);
      return internalErrorResponse();
    }
  });
}
