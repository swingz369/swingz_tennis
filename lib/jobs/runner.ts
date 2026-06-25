/**
 * F11: Job-Runner auf background_jobs-Tabelle — Retry + Dead-Letter ohne externen Queue-Dienst.
 *
 * Nutzung in Cron-Routes:
 *   await runJob('billing-overdue', {}, async () => { ...logic... });
 */
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('jobs:runner');

export async function runJob(
  jobName: string,
  payload: Record<string, unknown>,
  fn: () => Promise<unknown>
): Promise<void> {
  const sb = createServiceClient() as any;

  // Anlegen oder existierenden Job übernehmen
  const { data: job, error: claimErr } = await sb
    .from('background_jobs')
    .upsert(
      {
        job_name: jobName,
        job_type: 'recurring',
        status: 'running',
        payload,
        started_at: new Date().toISOString(),
      },
      { onConflict: 'job_name' }
    )
    .select('id, retry_count, max_retries')
    .single();

  if (claimErr || !job) {
    log.error(`Job ${jobName}: Claim fehlgeschlagen`, claimErr);
    return;
  }

  try {
    const result = await fn();
    await sb
      .from('background_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: { output: result ?? null },
        error_message: null,
      })
      .eq('id', job.id);
    log.info(`Job ${jobName}: abgeschlossen`);
  } catch (err) {
    const retries = (job.retry_count ?? 0) + 1;
    const maxRetries = job.max_retries ?? 3;
    const dead = retries >= maxRetries;
    await sb
      .from('background_jobs')
      .update({
        status: dead ? 'failed' : 'pending',
        retry_count: retries,
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: dead ? new Date().toISOString() : null,
      })
      .eq('id', job.id);
    log.error(
      `Job ${jobName}: Fehler ${retries}/${maxRetries}${dead ? ' → Dead-Letter' : ''}`,
      err instanceof Error ? err : undefined
    );
  }
}
