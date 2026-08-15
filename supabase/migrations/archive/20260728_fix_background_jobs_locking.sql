-- Fix race condition in lib/jobs/runner.ts: upsert(onConflict:'job_name') had no
-- unique constraint to conflict on, so parallel cron triggers created duplicate
-- rows and could run the same job concurrently instead of locking it.

-- Dedupe existing rows: keep the most recently started row per job_name.
DELETE FROM background_jobs a USING background_jobs b
WHERE a.job_name = b.job_name
  AND a.ctid < b.ctid;

ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_job_name_key UNIQUE (job_name);

-- Atomic claim: only takes the lock if the job is not currently 'running',
-- or its previous run is stale (crashed without completing).
CREATE OR REPLACE FUNCTION claim_background_job(
  p_job_name TEXT,
  p_job_type TEXT,
  p_payload JSONB,
  p_stale_after INTERVAL DEFAULT '15 minutes'
) RETURNS TABLE (id UUID, retry_count INTEGER, max_retries INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO background_jobs (job_name, job_type, status, payload, started_at)
  VALUES (p_job_name, p_job_type, 'running', p_payload, NOW())
  ON CONFLICT (job_name) DO UPDATE
    SET status = 'running',
        payload = EXCLUDED.payload,
        started_at = NOW()
    WHERE background_jobs.status != 'running'
       OR background_jobs.started_at < NOW() - p_stale_after
  RETURNING background_jobs.id, background_jobs.retry_count, background_jobs.max_retries;
END;
$$;

COMMENT ON FUNCTION claim_background_job IS 'Atomically claims a recurring job by name; returns no rows if another run already holds the lock and is not stale.';
