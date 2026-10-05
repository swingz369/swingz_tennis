/**
 * app/api/decisions/[id]/route.ts
 * GET    /api/decisions/[id]       → Decision + Invitations + Votes
 * PATCH  /api/decisions/[id]       → Admin: Status/Outcome/Quorum aktualisieren
 * DELETE /api/decisions/[id]       → Soft-Delete (status = 'cancelled')
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  type AuthContext,
  withApiAuth,
  verifyRole,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { validateRequestBody, formatValidationErrors } from '@/lib/validation-schemas';
import type { ZodError } from 'zod';
import { UpdateDecisionSchema } from '@/lib/types/decisions';
import { decisionService } from '@/lib/decisions/decision.service';

const log = createLogger('api:decisions/[id]');

/** RLS-Client; der Owner hat keine Vereins-Mitgliedschaft und liest über systemDb. */
function db(auth: AuthContext) {
  return auth.role === 'owner' ? systemDb('Owner: Beschlüsse aller Vereine') : getUserDb(auth);
}

/**
 * decisionService schreibt mit dem Service-Client und prüft den Verein nicht —
 * deshalb hier per RLS sicherstellen, dass der Beschluss zum Verein des Admins gehört.
 */
async function isOwnClubDecision(auth: AuthContext, id: string): Promise<boolean> {
  const { data } = await db(auth).from('board_decisions').select('id').eq('id', id).maybeSingle();
  return !!data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!auth.clubId) return unauthorizedResponse('Club-Kontext fehlt');
    const { id } = await params;

    const sb = db(auth);
    const { data: decision, error } = await sb
      .from('board_decisions')
      .select('*')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();
    if (error || !decision) {
      return NextResponse.json({ error: 'Beschluss nicht gefunden' }, { status: 404 });
    }

    // RLS handhabt: Members sehen completed-Beschlüsse frei, andere nur via admin
    const isAdmin = await verifyRole(auth, 'admin');
    const isMember = await verifyRole(auth, 'member');
    if (!isAdmin && isMember && decision.status !== 'completed') {
      return forbiddenResponse('Mitglieder sehen nur abgeschlossene Beschlüsse.');
    }

    const [invitations, votes] = await Promise.all([
      sb.from('meeting_invitations').select('*').eq('decision_id', id),
      sb.from('decision_votes').select('*').eq('decision_id', id),
    ]);

    return NextResponse.json({
      decision,
      invitations: invitations.data ?? [],
      votes: votes.data ?? [],
    });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      const hasRole = await verifyRole(auth, 'admin');
      if (!hasRole) return forbiddenResponse('Admin erforderlich');

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) return rateLimitError;

      const { id } = await params;
      if (!(await isOwnClubDecision(auth, id))) {
        return NextResponse.json({ error: 'Beschluss nicht gefunden' }, { status: 404 });
      }
      const body = await request.json();
      const validation = validateRequestBody(UpdateDecisionSchema, body);
      if (!validation.success) {
        const errors = (validation as { success: false; errors: ZodError }).errors;
        return NextResponse.json(
          {
            error: 'Ungültige Eingabe',
            details: formatValidationErrors(errors),
          },
          { status: 400 }
        );
      }

      try {
        const decision = await decisionService.updateDecision(id, auth.user.id, validation.data);
        return NextResponse.json({ decision });
      } catch (err) {
        log.error('PATCH /api/decisions/[id] fehlgeschlagen', {
          id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
      }
    });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      const hasRole = await verifyRole(auth, 'admin');
      if (!hasRole) return forbiddenResponse('Admin erforderlich');

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) return rateLimitError;

      const { id } = await params;
      if (!(await isOwnClubDecision(auth, id))) {
        return NextResponse.json({ error: 'Beschluss nicht gefunden' }, { status: 404 });
      }
      try {
        // Soft-Delete: status = 'cancelled' statt Hard-Delete (Audit!)
        const decision = await decisionService.updateDecision(id, auth.user.id, {
          status: 'cancelled',
        });
        return NextResponse.json({ decision });
      } catch (err) {
        log.error('DELETE /api/decisions/[id] fehlgeschlagen', {
          id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
      }
    });
  });
}
