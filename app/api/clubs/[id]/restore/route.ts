import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { clubs, userClubMemberships } from '@/infrastructure/persistence/schema';
import { db } from '@/infrastructure/persistence/db';
import { eq, and } from 'drizzle-orm';
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
 *   - verifyClubAccess() = Owner/Superadmin-Bypass. Admin (seltene Ausnahme)
 *     könnte theoretisch den eigenen Verein restaurieren, sofern er in der
 *     Rolle-Stufe passt — irrelevant in der Praxis, weil verifyRole bereits
 *     Superadmin verlangt.
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
      return forbiddenResponse('Superadmin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

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
      // Vor-Check: Verein muss existieren UND soft-deleted sein.
      // deleted_at NOT NULL ist das Indiz; ein bereits restaurierter Verein
      // würde 409 zurückgeben (kein No-Op-Re-Restore).
      const pre = await db
        .select({
          id: clubs.id,
          name: clubs.name,
          status: clubs.status,
          deleted_at: clubs.deleted_at,
        })
        .from(clubs)
        .where(eq(clubs.id, id))
        .limit(1);

      const club = pre[0];
      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      if (club.deleted_at === null) {
        return NextResponse.json(
          {
            error: 'Verein ist nicht soft-deleted — nichts zu restaurieren',
            current_status: club.status,
          },
          { status: 409 }
        );
      }

      // Restore: alles in einer Transaktion. Falls memberships reaktiviert
      // werden, aber das club-Update danach fehlschlägt, wird die
      // membership-Reaktivierung per ROLLBACK zurückgenommen — sonst
      // inkonsistenter Zustand (aktive memberships auf soft-deleted Club).
      const previousDeletedAt = club.deleted_at;
      const reactivatedCount = await db.transaction(async (tx) => {
        const updated = await tx
          .update(userClubMemberships)
          .set({ is_active: true })
          .where(and(eq(userClubMemberships.club_id, id), eq(userClubMemberships.is_active, false)))
          .returning({ id: userClubMemberships.id });

        await tx
          .update(clubs)
          .set({
            status: 'active',
            deleted_at: null,
            deleted_by: null,
            deletion_reason: null,
            updated_at: new Date(),
          })
          .where(eq(clubs.id, id));

        return updated.length;
      });

      try {
        await auditService.log({
          userId: auth.user.id,
          action: 'restore',
          entityType: 'club',
          entityId: id,
          clubId: id,
          details: {
            restore_mode: 'restore',
            previous_deleted_at: previousDeletedAt.toISOString(),
            club_name_before_restore: club.name,
            reactivated_members_count: reactivatedCount,
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
        reactivated_members_count: reactivatedCount,
        restored_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error restoring club:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
