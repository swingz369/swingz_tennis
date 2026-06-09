import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { dunningService } from '@/lib/billing/dunning.service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';

const log = createLogger('cron:billing-overdue');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret to prevent unauthorized invocation
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sentry cron monitoring: start check-in
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'billing-overdue',
    status: 'in_progress',
  });

  try {
    const supabase = createServiceClient();

    // Mark invoices past due_date as overdue
    const { data: updated, error } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('status', ['open', 'draft'])
      .lt('due_date', new Date().toISOString())
      .select('id, club_id');

    if (error) throw error;

    log.info(`Marked ${updated?.length ?? 0} invoices as overdue`);

    // Run dunning for each affected club
    const clubIds = [...new Set((updated ?? []).map((inv) => inv.club_id).filter(Boolean))];
    const dunningResults = await Promise.allSettled(
      clubIds.map((clubId) => dunningService.processAutomaticDunning(clubId))
    );

    const dunningErrors = dunningResults.filter((r) => r.status === 'rejected');
    if (dunningErrors.length > 0) {
      log.warn(`Dunning errors for ${dunningErrors.length} clubs`);
    }

    // Sentry cron monitoring: mark as OK
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'billing-overdue', status: 'ok' });

    return NextResponse.json({
      success: true,
      overdueMarked: updated?.length ?? 0,
      clubsProcessed: clubIds.length,
    });
  } catch (error) {
    log.error('Billing overdue cron failed', { error });

    // Sentry cron monitoring: mark as error
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'billing-overdue', status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'billing-overdue' } });

    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
