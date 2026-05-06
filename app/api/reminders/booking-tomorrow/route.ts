import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { ReminderService } from '@/application/use-cases/send-reminders.use-case';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { sendRemindersSchema } from '@/application/validation/schemas/reminders.schema';

class TempSessionRepository {
  async findSessionsForDateRange(startDate: Date, endDate: Date) {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase
      .from('sessions')
      .select('*, trainers(*), courts(*), clubs(*)')
      .gte('timeslot_start', startDate.toISOString())
      .lte('timeslot_end', endDate.toISOString());
    return data || [];
  }
}

class TempBookingRepository {
  async findConfirmedBookingsForSessions(sessionIds: string[]) {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .in('session_id', sessionIds)
      .eq('status', 'confirmed');
    return data || [];
  }
}

class TempMemberRepository {
  async findMemberById(memberId: string) {
    const { createClient } = await import('@/infrastructure/external/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', memberId)
      .single();
    return data;
  }
}

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
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

      return NextResponse.json({
        success: true,
        dryRun: input.dryRun,
        total: results.length,
        sent: sentCount,
        failed: failedCount,
        results: results.slice(0, 50),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error sending reminders:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
