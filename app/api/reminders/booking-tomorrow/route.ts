import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { ReminderService } from '@/application/use-cases/send-reminders.use-case';
import { sendRemindersSchema } from '@/application/validation/schemas/reminders.schema';

// POST /api/reminders/booking-tomorrow – Send booking reminders for tomorrow
export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin/superadmin can trigger reminders
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id);
  const roles = (memberships as Array<{ role: string }> | null)?.map((m) => m.role) || [];
  const isAuthorized = roles.some((r) => r === 'admin' || r === 'superadmin');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await _request.json();
    const input = sendRemindersSchema.parse(body);

    const results = await ReminderService.sendTomorrowReminders(input);

    const sentCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      dryRun: input.dryRun,
      total: results.length,
      sent: sentCount,
      failed: failedCount,
      results: results.slice(0, 50), // Limit response size
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending reminders:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
