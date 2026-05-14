/**
 * Background Job Queue Client
 * Pattern from INTEGRATION_ROADMAP.md Phase 5 (Week 18)
 *
 * TypeScript client for enqueuing and managing background jobs
 * Works with pg-cron and Supabase Edge Functions
 */

import { createClient } from '@/infrastructure/external/supabase/server';

export type JobType = 'scheduled' | 'one_time' | 'recurring';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJob {
  id: string;
  job_name: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, any>;
  schedule_expression?: string;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  result?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueJobOptions {
  jobName: string;
  jobType: JobType;
  payload?: Record<string, any>;
  scheduleExpression?: string; // Cron expression for recurring jobs
  scheduledAt?: Date; // When to run (default: now)
  priority?: number; // 1-10 (10 = highest)
  maxRetries?: number; // Default: 3
}

export interface JobExecutionResult {
  success: boolean;
  result?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Background Job Queue Service
 *
 * Manages background jobs and scheduled tasks
 */
export class BackgroundJobQueue {
  /**
   * Enqueue a new background job
   *
   * @example
   * ```ts
   * const jobId = await backgroundJobQueue.enqueue({
   *   jobName: 'generate-invoices',
   *   jobType: 'one_time',
   *   payload: { clubId: 'abc123', month: '2026-05' },
   *   priority: 8
   * });
   * ```
   */
  async enqueue(options: EnqueueJobOptions): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any).rpc('enqueue_job', {
      p_job_name: options.jobName,
      p_job_type: options.jobType,
      p_payload: options.payload || {},
      p_schedule_expression: options.scheduleExpression || null,
      p_scheduled_at: options.scheduledAt?.toISOString() || new Date().toISOString(),
      p_priority: options.priority || 5,
    });

    if (error) {
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Schedule a recurring job using cron expression
   *
   * @example
   * ```ts
   * await backgroundJobQueue.scheduleRecurring({
   *   jobName: 'daily-cleanup',
   *   scheduleExpression: '0 3 * * *', // 3 AM daily
   *   payload: { task: 'cleanup' }
   * });
   * ```
   */
  async scheduleRecurring(options: {
    jobName: string;
    scheduleExpression: string;
    payload?: Record<string, any>;
    priority?: number;
  }): Promise<string> {
    return this.enqueue({
      jobName: options.jobName,
      jobType: 'recurring',
      scheduleExpression: options.scheduleExpression,
      payload: options.payload,
      priority: options.priority,
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<BackgroundJob | null> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get job: ${error.message}`);
    }

    return data as BackgroundJob;
  }

  /**
   * Get all jobs (with filters)
   */
  async getJobs(filters?: {
    status?: JobStatus;
    jobName?: string;
    jobType?: JobType;
    limit?: number;
  }): Promise<BackgroundJob[]> {
    const supabase = await createClient();

    let query = (supabase as any)
      .from('background_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.jobName) {
      query = query.eq('job_name', filters.jobName);
    }

    if (filters?.jobType) {
      query = query.eq('job_type', filters.jobType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get jobs: ${error.message}`);
    }

    return data as BackgroundJob[];
  }

  /**
   * Get pending jobs ready to execute
   */
  async getPendingJobs(limit = 10): Promise<BackgroundJob[]> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any).rpc('get_pending_jobs', {
      p_limit: limit,
    });

    if (error) {
      throw new Error(`Failed to get pending jobs: ${error.message}`);
    }

    return data as BackgroundJob[];
  }

  /**
   * Mark job as running
   */
  async startJob(jobId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any).rpc('start_job', {
      p_job_id: jobId,
    });

    if (error) {
      throw new Error(`Failed to start job: ${error.message}`);
    }

    return data as boolean;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string, result?: Record<string, any>): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any).rpc('complete_job', {
      p_job_id: jobId,
      p_result: result || {},
    });

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    return data as boolean;
  }

  /**
   * Mark job as failed
   * Will automatically retry if retry_count < max_retries
   */
  async failJob(jobId: string, errorMessage: string, stackTrace?: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any).rpc('fail_job', {
      p_job_id: jobId,
      p_error_message: errorMessage,
      p_stack_trace: stackTrace || null,
    });

    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }

    return data as boolean;
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const supabase = await createClient();

    const { error } = await (supabase as any)
      .from('background_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to cancel job: ${error.message}`);
    }

    return true;
  }

  /**
   * Get job execution history
   */
  async getJobHistory(jobId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('job_execution_log')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get job history: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job statistics
   */
  async getJobStats(filters?: { jobName?: string; since?: Date }): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    successRate: number;
  }> {
    const supabase = await createClient();

    let query = (supabase as any)
      .from('background_jobs')
      .select('status', { count: 'exact', head: false });

    if (filters?.jobName) {
      query = query.eq('job_name', filters.jobName);
    }

    if (filters?.since) {
      query = query.gte('created_at', filters.since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get job stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      pending: data?.filter((j: any) => j.status === 'pending').length || 0,
      running: data?.filter((j: any) => j.status === 'running').length || 0,
      completed: data?.filter((j: any) => j.status === 'completed').length || 0,
      failed: data?.filter((j: any) => j.status === 'failed').length || 0,
      successRate: 0,
    };

    const completedOrFailed = stats.completed + stats.failed;
    if (completedOrFailed > 0) {
      stats.successRate = (stats.completed / completedOrFailed) * 100;
    }

    return stats;
  }
}

/**
 * Singleton instance
 */
export const backgroundJobQueue = new BackgroundJobQueue();

/**
 * Common job types (examples)
 */
export const JobTypes = {
  GENERATE_INVOICES: 'generate-invoices',
  SEND_REMINDERS: 'send-reminders',
  CLEANUP_OLD_DATA: 'cleanup-old-data',
  GENERATE_REPORTS: 'generate-reports',
  SYNC_EXTERNAL_DATA: 'sync-external-data',
  PROCESS_PAYMENTS: 'process-payments',
  SEND_WEEKLY_SUMMARY: 'send-weekly-summary',
} as const;
