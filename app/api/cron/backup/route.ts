import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';

const log = createLogger('cron:backup');

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for Pro plan

const STORAGE_BUCKET = 'swingz-files';
const BACKUP_PREFIX = 'backups';
const MAX_BACKUPS = 30; // Keep last 30 daily backups

interface BackupMetadata {
  timestamp: string;
  tables: number;
  totalRows: number;
  fileSizeBytes: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

/**
 * Get the list of tables to back up.
 *
 * Uses a maintained hardcoded list of all user tables in the public schema.
 * This is the most reliable approach since it doesn't depend on RPC functions
 * or information_schema access which may be restricted on Supabase.
 *
 * When adding new tables via migrations, add them to this list.
 */
function getBackupTables(): string[] {
  return BACKUP_TABLES;
}

/**
 * Maintained list of all user tables in the public schema.
 * Update this list when new tables are added via migrations.
 */
const BACKUP_TABLES = [
  'clubs',
  'trainers',
  'trainer_club',
  'courts',
  'schedules',
  'training_groups',
  'groups',
  'pricing_rules',
  'sessions',
  'bookings',
  'users',
  'user_club_memberships',
  'audit_logs',
  'invoices',
  'invoice_items',
  'seasons',
  'user_training_preferences',
  'season_plan_entries',
  'planning_conflicts',
  'season_planning_history',
  'billing_periods',
  'trainer_billings',
  'billing_line_items',
  'hours_logs',
  'attendance_records',
  'session_rsvps',
  'trainer_availabilities',
  'trainer_absences',
  'fee_configurations',
  'payment_settings',
  'system_settings',
  'sepa_mandates',
  'hourly_rate_tiers',
  'trainer_hourly_rates',
  'rate_history',
  'trainer_profiles',
  'trial_trainings',
];

/**
 * GET /api/cron/backup
 *
 * Automated daily backup triggered by Vercel Cron Job.
 * Exports all database tables as JSON and stores to Supabase Storage.
 *
 * Security:
 *  - Protected by CRON_SECRET (Bearer auth header)
 *  - Only accessible via Vercel Cron or authenticated requests
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret to prevent unauthorized invocation
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn('Unauthorized backup attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  log.info('Starting automated database backup');

  try {
    const supabase = createServiceClient();

    const backupTables = getBackupTables();
    log.info(`Backing up ${backupTables.length} tables`);

    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    // Export each table
    for (const table of backupTables) {
      try {
        let allRows: unknown[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        // Paginate through large tables
        while (hasMore) {
          const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact' })
            .range(from, from + pageSize - 1);

          if (error) {
            // Table might not exist or have RLS issues
            log.warn(`Skipping table "${table}": ${error.message}`);
            errors.push(`${table}: ${error.message}`);
            break;
          }

          if (data && data.length > 0) {
            allRows = allRows.concat(data);
          }

          const fetched = data?.length ?? 0;
          from += fetched;
          hasMore = fetched === pageSize && (count ?? 0) > from;
        }

        if (allRows.length > 0 || errors.length === 0) {
          backupData[table] = allRows;
          totalRows += allRows.length;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Error backing up table "${table}": ${message}`);
        errors.push(`${table}: ${message}`);
      }
    }

    // Build metadata
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      tables: Object.keys(backupData).length,
      totalRows,
      fileSizeBytes: 0, // Updated after upload
      status: errors.length === 0 ? 'success' : 'partial',
      ...(errors.length > 0 ? { errors } : {}),
    };

    // Serialize to JSON
    const backupPayload = {
      metadata,
      data: backupData,
    };

    const jsonBuffer = Buffer.from(JSON.stringify(backupPayload), 'utf-8');
    metadata.fileSizeBytes = jsonBuffer.length;

    // Generate filename: backups/YYYY-MM-DDTHH-MM-SSZ.json
    const filename = `${BACKUP_PREFIX}/${metadata.timestamp.replace(/[:.]/g, '-')}.json`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, jsonBuffer, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      log.error('Failed to upload backup to storage', { error: uploadError });
      return NextResponse.json(
        { error: 'Backup upload failed', details: uploadError.message },
        { status: 500 }
      );
    }

    // Cleanup old backups (keep only the last MAX_BACKUPS)
    await cleanupOldBackups(supabase);

    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
    log.info(`Backup completed in ${duration}s`, {
      tables: metadata.tables,
      rows: metadata.totalRows,
      size: `${(metadata.fileSizeBytes / 1024).toFixed(1)} KB`,
    });

    return NextResponse.json({
      success: true,
      metadata,
      duration_seconds: parseFloat(duration),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Backup cron failed', { error: message });
    return NextResponse.json({ error: 'Backup failed', details: message }, { status: 500 });
  }
}

/**
 * Remove backups older than MAX_BACKUPS days.
 * Keeps the most recent backups and removes older ones.
 */
async function cleanupOldBackups(supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(BACKUP_PREFIX, {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error || !data) {
      log.warn('Failed to list backups for cleanup', { error });
      return;
    }

    const backupFiles = data
      .filter((f) => f.name.endsWith('.json'))
      .sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );

    const toDelete = backupFiles.slice(MAX_BACKUPS);
    if (toDelete.length > 0) {
      const paths = toDelete.map((f) => `${BACKUP_PREFIX}/${f.name}`);
      const { error: deleteError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);

      if (deleteError) {
        log.warn('Failed to delete old backups', { error: deleteError });
      } else {
        log.info(`Cleaned up ${toDelete.length} old backup(s)`);
      }
    }
  } catch (err) {
    log.warn('Backup cleanup error', { error: String(err) });
  }
}
