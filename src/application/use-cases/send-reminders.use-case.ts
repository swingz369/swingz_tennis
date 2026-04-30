import { createClient } from '@/infrastructure/external/supabase/server';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import {
  SendRemindersInput,
  ReminderResult,
} from '@/application/validation/schemas/reminders.schema';

interface Session {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  trainer_id: string;
  court_id: string;
  club_id: string;
  trainers?: { name: string; email?: string };
  courts?: { name: string };
  clubs?: { name: string };
}

interface Booking {
  id: string;
  member_id: string;
  session_id: string | number;
  status: string;
}

export class ReminderService {
  /**
   * Send booking reminders for tomorrow's sessions
   */
  static async sendTomorrowReminders(input: SendRemindersInput): Promise<ReminderResult[]> {
    const supabase = await createClient();
    const results: ReminderResult[] = [];

    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Find all sessions for tomorrow
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(
        `
        id,
        timeslot_start,
        timeslot_end,
        trainer_id,
        court_id,
        club_id,
        trainers (name, email),
        courts (name),
        clubs (name)
      `
      )
      .gte('timeslot_start', tomorrow.toISOString())
      .lte('timeslot_start', tomorrowEnd.toISOString())
      .eq('is_active', true);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return results;
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for tomorrow');
      return results;
    }

    const sessionIds = sessions.map((s: Session) => s.id);

    // Get all bookings for these sessions
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, member_id, session_id, status')
      .in('session_id', sessionIds)
      .eq('status', 'confirmed');

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return results;
    }

    if (!bookings || bookings.length === 0) {
      console.log('No confirmed bookings for tomorrow');
      return results;
    }

    // Group bookings by session
    const bookingsBySession = new Map<string | number, Booking[]>();
    (bookings as Booking[]).forEach((booking: Booking) => {
      const existing = bookingsBySession.get(booking.session_id) || [];
      existing.push(booking);
      bookingsBySession.set(booking.session_id, existing);
    });

    // Send reminder for each booking
    for (const session of sessions as Session[]) {
      const sessionBookings = bookingsBySession.get(session.id) || [];

      for (const booking of sessionBookings) {
        try {
          // Get member details
          const { data: member } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', booking.member_id)
            .single();

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
            console.log(
              `[DRY RUN] Would send reminder to ${member.email} for session ${session.id}`
            );
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

          await EmailService.sendBookingReminder(member.email, emailData);

          // Audit log
          await AuditService.log('system', 'reminder_sent', 'booking', booking.id, {
            type: 'booking_reminder',
            sessionId: session.id,
            memberId: booking.member_id,
            method: 'email',
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
          console.error(`Error sending reminder for booking ${booking.id}:`, error);
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
