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

const log = createLogger('api:reminders:booking-tomorrow');

class TempSessionRepository implements ISessionRepository {
  async findSessionsForDateRange(startDate: Date, endDate: Date): Promise<Session[]> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sessions')
      .select('*, trainers(*), courts(*), clubs(*)')
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
      const club = (Array.isArray(session.clubs) ? session.clubs[0] : session.clubs) as
        { name: string } | undefined;
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
  async findConfirmedBookingsForSessions(sessionIds: string[]): Promise<Booking[]> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
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
  async findMemberById(memberId: string): Promise<{ email: string; full_name: string } | null> {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
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

      const reminderService = new ReminderService(
        new EmailService(),
        new AuditServiceImpl(),
        new TempSessionRepository(),
        new TempBookingRepository(),
        new TempMemberRepository()
      );

      const results = await reminderService.sendTomorrowReminders(input);

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
      if (!input.dryRun) await recordHeartbeat('cron-booking-reminders');
      return NextResponse.json({
        success: true,
        dryRun: input.dryRun,
        total: results.length,
        sent: sentCount,
        failed: failedCount,
        results: results.slice(0, 50),
      });
    } catch (error) {
      log.error('Error sending reminders:', error);
      return internalErrorResponse();
    }
  });
}
