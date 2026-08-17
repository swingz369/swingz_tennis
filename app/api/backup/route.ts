import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { withCSRFProtection } from '@/lib/csrf';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:backup');

export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'swingz-files';
const BACKUP_PREFIX = 'backups';

/**
 * GET /api/backup
 *
 * List available backups from Supabase Storage.
 * Admin-only: requires admin or superadmin role.
 */
export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');

    try {
      const serviceClient = createServiceClient();

      const { data, error } = await serviceClient.storage.from(STORAGE_BUCKET).list(BACKUP_PREFIX, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) {
        log.error('Backups konnten nicht aufgelistet werden', { error });
        return NextResponse.json(
          { error: 'Backups konnten nicht aufgelistet werden' },
          { status: 500 }
        );
      }

      const backups = (data ?? [])
        .filter((f) => f.name.endsWith('.json'))
        .map((f) => ({
          filename: f.name,
          path: `${BACKUP_PREFIX}/${f.name}`,
          size_bytes: f.metadata?.size ?? 0,
          size_formatted: formatFileSize(f.metadata?.size ?? 0),
          created_at: f.created_at,
        }))
        .sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        );

      return NextResponse.json({
        backups,
        total: backups.length,
        storage_bucket: STORAGE_BUCKET,
        storage_prefix: BACKUP_PREFIX,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error listing backups', { error: message });
      return internalErrorResponse();
    }
  });
}

/**
 * POST /api/backup
 *
 * Manually trigger an immediate database backup.
 * Returns the same metadata as the cron backup.
 *
 * Protected by CSRF + admin auth check.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');

    const response = await withCSRFProtection(request, async () => {
      const startedAt = Date.now();
      log.info('Manual backup triggered by admin', { userId: auth.user.id });

      try {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          log.error('CRON_SECRET not configured - manual backup unavailable');
          return NextResponse.json(
            { error: 'Backup-System nicht vollständig konfiguriert: CRON_SECRET fehlt' },
            { status: 500 }
          );
        }

        // Call the cron backup logic (reuse the same function). Ziel aus
        // appBaseUrl() statt request.url: request.url leitet sich vom Host-Header
        // ab — ein manipulierter Host würde den Selbst-Aufruf samt CRON_SECRET
        // im Authorization-Header auf einen fremden Server umlenken (SSRF).
        const backupUrl = `${appBaseUrl()}/api/cron/backup`;

        const response = await fetch(backupUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
          },
        });

        const result = await response.json();
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);

        if (!response.ok) {
          log.error('Manual backup failed', { status: response.status, result });
          return NextResponse.json(
            { error: 'Backup fehlgeschlagen', details: result },
            { status: response.status }
          );
        }

        log.info(`Manual backup completed in ${duration}s`, { userId: auth.user.id });
        return NextResponse.json({
          ...result,
          duration_seconds: parseFloat(duration),
          triggered_by: 'manual',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error('Manual backup error', { error: message });
        return internalErrorResponse();
      }
    });
    return response as NextResponse;
  });
}

/**
 * DELETE /api/backup?file=<path>
 *
 * Delete a specific backup file from storage.
 * Protected by CSRF + admin auth check.
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');

    const response = await withCSRFProtection(request, async () => {
      const { searchParams } = new URL(request.url);
      const filePath = searchParams.get('file');

      if (!filePath) {
        return NextResponse.json({ error: 'Parameter ?file= fehlt' }, { status: 400 });
      }

      // Prevent path traversal
      if (!filePath.startsWith(BACKUP_PREFIX) || filePath.includes('..')) {
        return NextResponse.json({ error: 'Ungültiger Dateipfad' }, { status: 400 });
      }

      try {
        const serviceClient = createServiceClient();

        const { error } = await serviceClient.storage.from(STORAGE_BUCKET).remove([filePath]);

        if (error) {
          log.error('Backup konnte nicht gelöscht werden', {
            error,
            path: filePath,
            userId: auth.user.id,
          });
          return NextResponse.json(
            { error: 'Backup konnte nicht gelöscht werden' },
            { status: 500 }
          );
        }

        log.info(`Backup deleted: ${filePath}`, { userId: auth.user.id });
        return NextResponse.json({ success: true, deleted: filePath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error('Error deleting backup', { error: message });
        return internalErrorResponse();
      }
    });
    return response as NextResponse;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
