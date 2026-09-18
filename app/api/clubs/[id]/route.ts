import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  ApiException,
  errorResponse,
  internalErrorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { z } from 'zod';
import { ClubService } from '@/application/services/club.service';
import { updateClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { verifyHardDeleteToken } from '@/lib/security/hard-delete-token';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]');

// Zod-Schema für optionalen Body im DELETE-Handler (Soft-Delete-Pfad)
const deletionBodySchema = z.object({
  deletion_reason: z.string().max(500).optional(),
});

const auditService = new AuditServiceImpl();

/**
 * GET /api/clubs/[id]
 *
 * Detail-Snapshot eines Vereins. Eingesetzt vom Owner-Master-Drawer
 * (Phase 2) sowie vom Admin-Settings-Tab.
 *
 * ⛔ Sicherheits-Hinweis (Pre-Phase-2): Diese Route war `verifyRole('member')`
 * ohne `verifyClubAccess` — das ließ jeden eingeloggten User die Stammdaten
 * jedes beliebigen Vereins lesen, wenn er die ID kannte. Jetzt:
 *   - Admin: nur für den eigenen Verein (verifiziert via Cookie)
 *   - Owner / Superadmin: jeder Verein (auch gelöschte — Phase 1 Soft-Delete)
 * - Member: 403 (Stammdaten-Abruf geht über die Liste /api/clubs mit eigener Filterung)
 *
 * Owner + Superadmin erhalten zusätzlich einen kompakten Snapshot mit
 * Admin-Email und Stripe-Subscription — das ist genau das, was der
 * Detail-Drawer braucht, und es umgeht keinen RLS, weil der Service-Client
 * nach strikter Rollen-Gate dann iso-liert reingelassen wird.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const service = new ClubService(auth);
      const { club: row, memberCount } = await service.getWithMemberCount(id);

      const baseResponse = {
        id: row.id,
        name: row.name,
        maxMembers: row.max_members,
        openingHours: row.opening_hours,
        status: row.status,
        memberCount,
        bundesland: row.bundesland,
        billing_unit_minutes: row.billing_unit_minutes,
        tax_rate: row.tax_rate,
        default_payment_method: row.default_payment_method,
        invoice_number_prefix: row.invoice_number_prefix,
        city: row.city,
        description: row.description,
        logo_url: row.logo_url,
      };

      // Platform-staff sehen zusätzlich Admin + Stripe — beide Felder
      // sind im Service-Client-Modus abrufbar, da die Rollen-Check
      // schon oben (verifyRole('admin') + verifyClubAccess) durch ist.
      const isPlatformStaff = auth.role === 'owner' || auth.role === 'superadmin';
      if (!isPlatformStaff) {
        return NextResponse.json(baseResponse);
      }

      const adminSnapshot = await service.getPlatformSnapshot(id);

      return NextResponse.json({
        ...baseResponse,
        admin: adminSnapshot,
        stripe_live_mode: !!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error getting club:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    // verifyRole('admin') erfüllt Owner implizit (Hierarchie 5 > 3).
    // verifyClubAccess gibt Owner + Superadmin via Bypass true. → Owner kann
    // ohne explizite Rollen-Anpassung patchen.
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    return withValidation(updateClubSchema, async (input) => {
      try {
        await new ClubService(auth).update(id, input);

        try {
          await auditService.log({
            userId: auth.user.id,
            action: 'update',
            entityType: 'club',
            entityId: id,
            clubId: id,
            details: input as unknown as Record<string, unknown>,
          });
        } catch (auditError) {
          log.warn('Failed to record audit log:', auditError);
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Error updating club:', error);
        return errorResponse('VALIDATION_ERROR', 'Verein konnte nicht aktualisiert werden');
      }
    })(req);
  });
}

/**
 * DELETE /api/clubs/[id]
 *
 * Phase 1 — Soft-Delete als Default-Pfad.
 *
 * Verhalten:
 *   - DELETE ohne Body/Flags → SOFT-DELETE: status='deleted', deleted_at=now,
 *     deleted_by=auth.uid, alle memberships des Vereins is_active=false.
 *     Stripe wird NICHT automatisch refundiert — Kunde entscheidet.
 *
 *   - DELETE mit ?hard=true + Header `X-Confirm-Hard-Delete: <exakter Vereinsname>`
 *     → echte Hard-Delete-Zeile in clubs (alle CASCADE FKs in der DB erledigen
 *     den Rest). Nur `superadmin` oder `owner` darf das, weil das
 *     unwiderruflich ist. Soft-Delete-Audit-Eintrag wird mit
 *     `soft_delete: false, hard_delete: true` mitprotokolliert.
 *
 * Sicherheitsaspekte:
 *   - Header-Bestätigung mit dem exakten Vereinsnamen verhindert Click-Bombing
 *     und IDOR-Versuche (Angreifer kennt die ID, aber nicht den Namen).
 *   - Audit-Log mit voller Payload (gelöschte Member-Counts, deletion_reason).
 *   - RLS: Soft-Delete über User-Client (RLS aktiv), kein Bypass. Cascade
 *     auf memberships: weil die memberships SELECT-RLS-Filterung auf
 *     active Vereine macht, sind nach dem Soft-Delete niemandem mehr
 *     Logins dieses Vereins möglich.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'superadmin'))) {
      return forbiddenResponse('Zugriff nur für Superadmins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const service = new ClubService(auth);
      await service.getById(id); // 404 vor der Token-Prüfung

      // Hard-Delete-Pfad?
      // Token kommt im Format `${ts}.${hmac}` aus POST /api/clubs/[id]/hard-delete-token.
      const wantsHardDelete = req.nextUrl.searchParams.get('hard') === 'true';
      const tokenHeader = req.headers.get('x-hard-delete-token');
      const hardDeleteConfirmed = verifyHardDeleteToken(auth.user.id, id, tokenHeader);

      if (wantsHardDelete && !hardDeleteConfirmed) {
        return NextResponse.json(
          {
            error:
              'Hard-Delete benötigt ein gültiges X-Hard-Delete-Token. Token via POST /api/clubs/[id]/hard-delete-token erzeugen (gültig 5 Min).',
          },
          { status: 400 }
        );
      }

      // ── Hard-Delete ────────────────────────────────────────────────
      // Owner oder Superadmin. Owner hat Hierarchie 5 > 3 → verifyRole('superadmin')
      // gibt Owner bereits durch. Echte DB-Delete-Zeile.
      // FK auf user_club_memberships.club_id ist ON DELETE CASCADE → Memberships
      // werden von Postgres selbst mitgelöscht. Audit-Log-Eintrag erhält
      // club_id=undefined (audit_logs.club_id ist nullable, kein FK-Conflict).
      //
      // Audit-Action UNIFIZIERT auf 'delete' mit details.delete_mode='hard'.
      // Andernfalls wäre `searchQueries: { action: 'delete' }` im Owner-
      // Audit-Log-Filter (Phase 4) zu eng — die Owner-Plattform-Sicht möchte
      // alle Löschungen sehen und unterscheidet dann via details.delete_mode
      // zwischen soft/hard. Das Feld heißt `delete_mode` (statt `mode`), damit
      // zukünftige Audit-Einträge, die `mode` für andere Konzepte brauchen
      // (`preview`, `dry_run`...), nicht kollidieren.
      if (wantsHardDelete && hardDeleteConfirmed) {
        const { name, deactivated: deactivatedCount } = await service.hardDelete(id);

        try {
          await auditService.log({
            userId: auth.user.id,
            action: 'delete',
            entityType: 'club',
            entityId: id,
            details: {
              delete_mode: 'hard',
              club_name_before_delete: name,
              deactivated_members_count: deactivatedCount,
              stripe_refund_triggered: false, // Plattform-Customer überlebt; Refund-Event hier nicht anwendbar.
            },
          });
        } catch (auditError) {
          log.warn('Audit log failed (hard delete):', auditError);
        }

        return NextResponse.json({
          success: true,
          mode: 'hard_delete',
          deactivated_members_count: deactivatedCount,
        });
      }

      // ── Soft-Delete (Default) ──────────────────────────────────────
      // Body optional: { deletion_reason: string<max500> }
      let deletionReason: string | undefined;
      try {
        const ct = req.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const body = await req.json().catch(() => ({}));
          const parsed = deletionBodySchema.safeParse(body);
          if (parsed.success && parsed.data.deletion_reason !== undefined) {
            deletionReason = parsed.data.deletion_reason;
          }
        }
      } catch {
        // Kein Body oder kein JSON — deletion_reason bleibt undefined.
      }

      // Status + Memberships atomar in der DB (soft_delete_club).
      const { name, deactivated: softDeleteResult } = await service.softDelete(id, deletionReason);

      try {
        await auditService.log({
          userId: auth.user.id,
          action: 'delete',
          entityType: 'club',
          entityId: id,
          clubId: id,
          details: {
            delete_mode: 'soft',
            club_name_before_delete: name,
            deletion_reason: deletionReason,
            deactivated_members_count: softDeleteResult,
            stripe_refund_triggered: false, // bewusst: Kunde entscheidet
          },
        });
      } catch (auditError) {
        log.warn('Audit log failed (soft delete):', auditError);
      }

      return NextResponse.json({
        success: true,
        mode: 'soft_delete',
        deactivated_members_count: softDeleteResult,
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error deleting club:', error);
      return internalErrorResponse();
    }
  });
}
