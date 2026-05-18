import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { dunningService } from '@/lib/billing/dunning.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:billing-overdue');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret to prevent unauthorized invocation
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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

    return NextResponse.json({
      success: true,
      overdueMarked: updated?.length ?? 0,
      clubsProcessed: clubIds.length,
    });
  } catch (error) {
    log.error('Billing overdue cron failed', { error });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
