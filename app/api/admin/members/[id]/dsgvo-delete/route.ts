/**
 * app/api/admin/members/[id]/dsgvo-delete/route.ts — Admin-DSGVO-Löschung (F6.5)
 *
 * POST /api/admin/members/[id]/dsgvo-delete
 *
 * Löst die DSGVO Art. 17-Löschung für ein target-Membership aus.
 * Audit-Trail trägt actor_id = Auth-Admin (nicht den User selbst).
 *
 * **Auth-Modell:**
 *  - Admin-Endpoint: nur Admin/Owner/Superadmin (Club-Match).
 *  - Self-Service-Löschung läuft separat über `app/api/user/delete/route.ts`.
 *  - User (gelöscht) hat KEINEN Check auf `auth.clubId` — der Admin gehört
 *    zum Club, der Member darf aus jedem Club gelöscht werden (Admin-Decision).
 *
 * **DSGVO Art. 5 Abs. 2 Konformität:** Audit-Log wird VOR den DB-Writes
 * geschrieben (Intent-First-Pattern). Selbst bei Crash in Schritt 3-5
 * hat der Operator einen vollständigen Audit-Trace.
 *
 * **Idempotenz:** Mehrfach-Aufruf ist safe (UPDATE matchen 0 rows).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { runDsgvoDeleteFlow } from '@/lib/dsgvo/anonymize-flow';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:members:dsgvo-delete');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    // 1. Rate-Limit (POST-mutativ + sensible Admin-Action)
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    // 2. Admin-Rolle erforderlich
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin-Berechtigung erforderlich für DSGVO-Löschung');
    }

    const { id: membershipId } = await params;
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership-ID fehlt' }, { status: 400 });
    }

    // 3. Confirm-Flag im Body
    let body: { confirm?: boolean } = {};
    try {
      const raw = await request.json();
      body = typeof raw === 'object' && raw !== null ? raw : {};
    } catch {
      // leerer Body OK, default to no-confirm
    }
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'Bestätigung (confirm: true) erforderlich' },
        { status: 400 }
      );
    }

    const serviceSb = createServiceClient();

    // 4. Vor-Read: Membership existiert + Club-Match (außer Owner/Superadmin)
    const { data: membership, error: readError } = await serviceSb
      .from('user_club_memberships')
      .select('user_id, club_id')
      .eq('id', membershipId)
      .maybeSingle();

    if (readError) {
      log.error('Failed to read membership for dsgvo-delete', {
        membershipId,
        error: readError,
      });
      return NextResponse.json(
        { error: 'Datenbankfehler beim Lesen der Mitgliedschaft' },
        { status: 500 }
      );
    }
    if (!membership) {
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    }

    // Superadmin/Owner dürfen alle Clubs; Admin nur den eigenen.
    if (auth.role !== 'superadmin' && auth.role !== 'owner' && membership.club_id !== auth.clubId) {
      log.warn('Club-mismatch on dsgvo-delete', {
        membershipId,
        actorClub: auth.clubId,
        targetClub: membership.club_id,
        actorRole: auth.role,
      });
      return forbiddenResponse('Du kannst nur Mitglieder im eigenen Verein löschen');
    }

    // 5. Orchestriere den vollständigen DSGVO-Delete-Flow.
    //    Audit-First: das Audit-Log wird VOR den DB-Writes geschrieben
    //    (Intent-First-Pattern → Crash-Resilience + Compliance-Trace).
    try {
      const result = await runDsgvoDeleteFlow(serviceSb, {
        userId: membership.user_id,
        actorId: auth.user.id,
        deleteReason: 'admin_dsgvo_request',
      });

      log.info('Admin DSGVO delete completed', {
        targetMembership: membershipId,
        targetUser: membership.user_id,
        actorId: auth.user.id,
        pseudonym: result.pseudonym,
        membershipsDeactivated: result.membershipsDeactivated,
        trainerNotesDeleted: result.trainerNotesDeleted,
        auditLogged: result.auditLogged,
        authUserDeleted: result.authUserDeleted,
      });

      return NextResponse.json(
        {
          success: true,
          pseudonym: result.pseudonym,
          membershipsDeactivated: result.membershipsDeactivated,
          trainerNotesDeleted: result.trainerNotesDeleted,
          auditLogged: result.auditLogged,
        },
        { status: 200 }
      );
    } catch (err) {
      log.error('Admin DSGVO delete failed', err instanceof Error ? err : undefined);
      return NextResponse.json(
        {
          error: 'Löschung fehlgeschlagen',
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  });
}
