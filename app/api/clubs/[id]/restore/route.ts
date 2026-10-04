import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  ApiException,
  errorResponse,
  internalErrorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { z } from 'zod';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { ClubService } from '@/application/services/club.service';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:restore');

// Optional Body: { restoration_reason?: string<max500> }
const restoreBodySchema = z.object({
  restoration_reason: z.string().max(500).optional(),
});

type RestoreBody = z.infer<typeof restoreBodySchema>;

const auditService = new AuditServiceImpl();

/**
 * POST /api/clubs/[id]/restore
 *
 * Phase 1 — Inverse des Soft-Delete. Stellt einen soft-gelöschten Verein wieder
 * her (status='active', deleted_at/deleted_by/deletion_reason zurückgesetzt,
 * alle memberships is_active wieder auf true).
 *
 * Verhalten:
 *   - 404 wenn Verein nicht gefunden
 *   - 409 wenn Verein nicht soft-deleted ist (kein No-Op — wir geben einen
 *     klaren Status zurück, damit UI nicht mehrfach hintereinander posten
 *     muss und Doppel-Logs entstehen)
 *   - 200 mit { success: true, mode: 'restore', reactivated_members_count,
 *     restored_at } bei Erfolg
 *
 * Sicherheit:
 *   - verifyRole('superadmin') = Owner via Hierarchie 5 > 3. Admin/Trainer/
 *     Member bekommen 403 — konsistent zum Soft-Delete-DELETE-Handler.
 *   - Vereinsbezug prüft die DB-Funktion `restore_club`: Owner, oder Superadmin
 *     mit (auch deaktivierter) Mitgliedschaft in genau diesem Verein. Die
 *     Route kann das nicht — nach dem Soft-Delete sind die Mitgliedschaften
 *     inaktiv und fehlen in `auth.memberships`. Fremde Vereine → 404.
 *   - Audit: action='restore', details.restore_mode='undelete',
 *     previous_deleted_at, reactivated_members_count,
 *     restoration_reason (optional).
 *   - KEIN HMAC-Token (Restore ist reversibel und deutlich weniger
 *     destruktiv als Hard-Delete — der Token ist für unwiderrufliche
 *     Operationen reserviert).
 *
 * Nicht-implizierte Annahme: Hard-Delete (DB-Delete-Zeile) ist NICHT
 * wiederherstellbar über diese Route — die Zeile existiert dann physisch
 * nicht mehr. Backup-Restore aus einem DB-Snapshot bleibt der einzige Weg.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'superadmin'))) {
      return forbiddenResponse('Zugriff nur für Superadmins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    // Body parse (optional, JSON only)
    let body: RestoreBody = {};
    try {
      const ct = req.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const raw = await req.json().catch(() => ({}));
        const parsed = restoreBodySchema.safeParse(raw);
        if (parsed.success) {
          body = parsed.data;
        }
      }
    } catch {
      // leerer Body oder kein JSON — body bleibt {}, ok
    }

    try {
      const restored = await new ClubService(auth).restore(id);

      try {
        await auditService.log({
          userId: auth.user.id,
          action: 'restore',
          entityType: 'club',
          entityId: id,
          clubId: id,
          details: {
            restore_mode: 'restore',
            previous_deleted_at: restored.previous_deleted_at,
            club_name_before_restore: restored.name,
            reactivated_members_count: restored.reactivated,
            restoration_reason: body.restoration_reason ?? null,
          },
        });
      } catch (auditError) {
        log.warn('Audit log failed (restore):', auditError);
      }

      return NextResponse.json({
        success: true,
        mode: 'restore',
        club_id: id,
        reactivated_members_count: restored.reactivated,
        restored_at: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), {
          status: error.status,
          details: error.details,
        });
      }
      log.error('Error restoring club:', error);
      return internalErrorResponse();
    }
  });
}
