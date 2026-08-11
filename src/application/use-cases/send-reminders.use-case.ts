import type { IEmailService, IAuditService } from '@/domain/services';
import type {
  SendRemindersInput,
  ReminderResult,
} from '@/application/validation/schemas/reminders.schema';
import { createLogger } from '@/lib/logger';

const log = createLogger('reminders');

export interface Session {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  trainer_id: string;
  court_id: string | null;
  trainers?: { name: string; email?: string };
  courts?: { name: string };
  clubs?: { name: string };
}

export interface Booking {
  id: string;
  member_id: string;
  session_id: string | number;
  status: string;
}

// Repository interfaces for data access
export interface ISessionRepository {
  findSessionsForDateRange(startDate: Date, endDate: Date): Promise<Session[]>;
}

export interface IBookingRepository {
  findConfirmedBookingsForSessions(sessionIds: string[]): Promise<Booking[]>;
}

export interface IMemberRepository {
  findMemberById(memberId: string): Promise<{ email: string; full_name: string } | null>;
}

export class ReminderService {
  constructor(
    private emailService: IEmailService,
    private auditService: IAuditService,
    private sessionRepository: ISessionRepository,
    private bookingRepository: IBookingRepository,
    private memberRepository: IMemberRepository
  ) {}

  /**
   * Send booking reminders for tomorrow's sessions
   */
  async sendTomorrowReminders(input: SendRemindersInput): Promise<ReminderResult[]> {
    const results: ReminderResult[] = [];

    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Find all sessions for tomorrow using repository
    const sessions = await this.sessionRepository.findSessionsForDateRange(tomorrow, tomorrowEnd);

    if (!sessions || sessions.length === 0) {
      log.info('No sessions found for tomorrow');
      return results;
    }

    const sessionIds = sessions.map((s: Session) => s.id);

    // Get all bookings for these sessions using repository
    const bookings = await this.bookingRepository.findConfirmedBookingsForSessions(sessionIds);

    if (!bookings || bookings.length === 0) {
      log.info('No confirmed bookings for tomorrow');
      return results;
    }

    // Group bookings by session
    const bookingsBySession = new Map<string | number, Booking[]>();
    bookings.forEach((booking: Booking) => {
      const existing = bookingsBySession.get(booking.session_id) || [];
      existing.push(booking);
      bookingsBySession.set(booking.session_id, existing);
    });

    // Send reminder for each booking
    for (const session of sessions) {
      const sessionBookings = bookingsBySession.get(session.id) || [];

      for (const booking of sessionBookings) {
        try {
          // Get member details using repository
          const member = await this.memberRepository.findMemberById(booking.member_id);

          if (!member) {
            results.push({
              sessionId: session.id,
              memberId: booking.member_id,
              memberEmail: '',
              memberName: 'Unknown',
              sessionStart: session.timeslot_start,
              sessionEnd: session.timeslot_end,
              status: 'failed',
              error: 'Member not found',
            });
            continue;
          }

          if (input.dryRun) {
            log.info(`[DRY RUN] Would send reminder to ${member.email} for session ${session.id}`);
            const emailData: {
              memberName: string;
              sessionStartFormatted: string;
              sessionEndFormatted: string;
              trainerName?: string;
              courtName?: string;
            } = {
              memberName: member.full_name || 'Member',
              sessionStartFormatted: new Date(session.timeslot_start).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              sessionEndFormatted: new Date(session.timeslot_end).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            };
            if (session.trainers?.name) emailData.trainerName = session.trainers.name;
            if (session.courts?.name) emailData.courtName = session.courts.name;

            results.push({
              sessionId: session.id,
              memberId: booking.member_id,
              memberEmail: member.email,
              memberName: member.full_name || 'Member',
              sessionStart: session.timeslot_start,
              sessionEnd: session.timeslot_end,
              trainerName: session.trainers?.name,
              courtName: session.courts?.name,
              clubName: session.clubs?.name,
              status: 'skipped',
            });
            continue;
          }

          // Send email
          const emailData: {
            memberName: string;
            sessionStartFormatted: string;
            sessionEndFormatted: string;
            trainerName?: string;
            courtName?: string;
          } = {
            memberName: member.full_name || 'Member',
            sessionStartFormatted: new Date(session.timeslot_start).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            sessionEndFormatted: new Date(session.timeslot_end).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          if (session.trainers?.name) emailData.trainerName = session.trainers.name;
          if (session.courts?.name) emailData.courtName = session.courts.name;

          // Send reminder email via interface
          const sessionDate = new Date(session.timeslot_start).toLocaleDateString('de-DE');
          const sessionTime = new Date(session.timeslot_start).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          });

          await this.emailService.sendBookingReminder(member.email, {
            memberName: member.full_name || 'Member',
            sessionDate,
            sessionTime,
            courtName: session.courts?.name || 'TBD',
            clubName: session.clubs?.name || 'TBD',
          });

          // Audit log via interface
          await this.auditService.log({
            userId: 'system',
            action: 'create', // Using generic action
            entityType: 'booking',
            entityId: booking.id,
            details: {
              type: 'booking_reminder',
              sessionId: session.id,
              memberId: booking.member_id,
              method: 'email',
            },
          });

          results.push({
            sessionId: session.id,
            memberId: booking.member_id,
            memberEmail: member.email,
            memberName: member.full_name || 'Member',
            sessionStart: session.timeslot_start,
            sessionEnd: session.timeslot_end,
            trainerName: session.trainers?.name,
            courtName: session.courts?.name,
            clubName: session.clubs?.name,
            status: 'sent',
          });
        } catch (error) {
          log.error(`Error sending reminder for booking ${booking.id}:`, error);
          results.push({
            sessionId: session.id,
            memberId: booking.member_id,
            memberEmail: '',
            memberName: 'Unknown',
            sessionStart: session.timeslot_start,
            sessionEnd: session.timeslot_end,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }
}
