-- ============================================================
-- Background Job Queue with pg-cron
-- Pattern from INTEGRATION_ROADMAP.md Phase 5 (Week 18)
-- ============================================================
--
-- Enables scheduled and asynchronous job execution
-- Uses pg_cron extension for scheduling
-- Tracks job status and history
--
-- Usage:
--   1. Enable pg_cron: CREATE EXTENSION pg_cron;
--   2. Run this migration
--   3. Schedule jobs using cron.schedule()
--
-- ============================================================

-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- Job Queue Table
-- ============================================================

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'scheduled', 'one_time', 'recurring'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10 (10 = highest priority)
  
  -- Payload
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Scheduling
  schedule_expression TEXT, -- Cron expression (e.g., '0 2 * * *')
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Result
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_job_type CHECK (job_type IN ('scheduled', 'one_time', 'recurring'))
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled_at ON background_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON background_jobs(created_at DESC);

-- ============================================================
-- Job Execution Log
-- ============================================================

CREATE TABLE IF NOT EXISTS job_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES background_jobs(id) ON DELETE CASCADE,
  
  -- Execution details
  execution_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER,
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT FALSE,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  stack_trace TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_execution_log_job_id ON job_execution_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_created_at ON job_execution_log(created_at DESC);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to enqueue a new job
CREATE OR REPLACE FUNCTION enqueue_job(
  p_job_name TEXT,
  p_job_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_schedule_expression TEXT DEFAULT NULL,
  p_scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  p_priority INTEGER DEFAULT 5
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO background_jobs (
    job_name,
    job_type,
    payload,
    schedule_expression,
    scheduled_at,
    priority,
    status
  ) VALUES (
    p_job_name,
    p_job_type,
    p_payload,
    p_schedule_expression,
    p_scheduled_at,
    p_priority,
    'pending'
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;

-- Function to mark job as running
CREATE OR REPLACE FUNCTION start_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE background_jobs
  SET 
    status = 'running',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
BEGIN
  -- Get started_at for duration calculation
  SELECT started_at INTO v_started_at
  FROM background_jobs
  WHERE id = p_job_id;
  
  -- Update job
  UPDATE background_jobs
  SET 
    status = 'completed',
    completed_at = NOW(),
    result = p_result,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log execution
  INSERT INTO job_execution_log (
    job_id,
    execution_started_at,
    execution_completed_at,
    execution_duration_ms,
    success,
    result
  ) VALUES (
    p_job_id,
    v_started_at,
    NOW(),
    EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000,
    TRUE,
    p_result
  );
  
  RETURN FOUND;
END;
$$;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error_message TEXT,
  p_stack_trace TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_retry_count INTEGER;
  v_max_retries INTEGER;
BEGIN
  -- Get job details
  SELECT started_at, retry_count, max_retries
  INTO v_started_at, v_retry_count, v_max_retries
  FROM background_jobs
  WHERE id = p_job_id;
  
  -- Check if we should retry
  IF v_retry_count < v_max_retries THEN
    -- Retry job
    UPDATE background_jobs
    SET 
      status = 'pending',
      retry_count = retry_count + 1,
      scheduled_at = NOW() + INTERVAL '5 minutes', -- Retry after 5 minutes
      updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    -- Mark as permanently failed
    UPDATE background_jobs
    SET 
      status = 'failed',
      completed_at = NOW(),
      error_message = p_error_message,
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
  
  -- Log execution
  INSERT INTO job_execution_log (
    job_id,
    execution_started_at,
    execution_completed_at,
    execution_duration_ms,
    success,
    error_message,
    stack_trace
  ) VALUES (
    p_job_id,
    v_started_at,
    NOW(),
    EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000,
    FALSE,
    p_error_message,
    p_stack_trace
  );
  
  RETURN FOUND;
END;
$$;

-- Function to get pending jobs
CREATE OR REPLACE FUNCTION get_pending_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  job_id UUID,
  job_name TEXT,
  job_type TEXT,
  payload JSONB,
  priority INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    id,
    job_name,
    job_type,
    payload,
    priority
  FROM background_jobs
  WHERE status = 'pending'
    AND scheduled_at <= NOW()
  ORDER BY priority DESC, scheduled_at ASC
  LIMIT p_limit;
$$;

-- ============================================================
-- Example: Schedule Daily Invoice Generation
-- ============================================================

-- Schedule daily invoice generation at 2 AM
SELECT cron.schedule(
  'generate-membership-invoices',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url:='https://qeckztuzeymuwwtyoryi.supabase.co/functions/v1/generate-invoices',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body:='{"job_type": "daily_invoices"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- Example: Schedule Weekly Reports
-- ============================================================

-- Schedule weekly reports every Monday at 8 AM
SELECT cron.schedule(
  'generate-weekly-reports',
  '0 8 * * 1', -- Every Monday at 8 AM
  $$
  SELECT net.http_post(
    url:='https://qeckztuzeymuwwtyoryi.supabase.co/functions/v1/generate-reports',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body:='{"job_type": "weekly_reports"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- Example: Cleanup Old Jobs (run daily at 3 AM)
-- ============================================================

SELECT cron.schedule(
  'cleanup-old-jobs',
  '0 3 * * *', -- Every day at 3 AM
  $$
  DELETE FROM background_jobs
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM job_execution_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_execution_log ENABLE ROW LEVEL SECURITY;

-- Superadmin can see all jobs
DROP POLICY IF EXISTS "background_jobs_superadmin_all" ON background_jobs;
CREATE POLICY "background_jobs_superadmin_all" ON background_jobs
  FOR ALL
  USING (is_superadmin());

-- Admins can see jobs for their club (if payload contains club_id)
DROP POLICY IF EXISTS "background_jobs_admin_select" ON background_jobs;
CREATE POLICY "background_jobs_admin_select" ON background_jobs
  FOR SELECT
  USING (
    is_superadmin() OR
    (payload->>'club_id')::uuid = ANY(get_user_club_ids())
  );

-- Service role can manage all jobs
DROP POLICY IF EXISTS "background_jobs_service_role" ON background_jobs;
CREATE POLICY "background_jobs_service_role" ON background_jobs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Job execution log follows same rules
DROP POLICY IF EXISTS "job_execution_log_superadmin_all" ON job_execution_log;
CREATE POLICY "job_execution_log_superadmin_all" ON job_execution_log
  FOR ALL
  USING (
    is_superadmin() OR
    EXISTS (
      SELECT 1 FROM background_jobs
      WHERE background_jobs.id = job_execution_log.job_id
    )
  );

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Composite index for job queue processing
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue ON background_jobs(status, priority DESC, scheduled_at ASC)
  WHERE status = 'pending';

-- Index for job history queries
CREATE INDEX IF NOT EXISTS idx_background_jobs_history ON background_jobs(job_name, status, completed_at DESC)
  WHERE status IN ('completed', 'failed');

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE background_jobs IS 'Queue for background jobs and scheduled tasks';
COMMENT ON TABLE job_execution_log IS 'Execution history for background jobs';
COMMENT ON FUNCTION enqueue_job IS 'Enqueue a new background job';
COMMENT ON FUNCTION start_job IS 'Mark job as running';
COMMENT ON FUNCTION complete_job IS 'Mark job as completed with result';
COMMENT ON FUNCTION fail_job IS 'Mark job as failed with error, retry if possible';
COMMENT ON FUNCTION get_pending_jobs IS 'Get pending jobs ordered by priority';
