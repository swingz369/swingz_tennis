/**
 * app/api/decisions/route.ts
 * GET  /api/decisions              → Liste eigener Vereins-Beschlüsse
 * POST /api/decisions              → Beschluss erstellen (+ optional Einladungen)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse, unauthorizedResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';
import { validateRequestBody, formatValidationErrors } from '@/lib/validation-schemas';
import type { ZodError } from 'zod';
import { CreateDecisionSchema, type CreateDecisionInput } from '@/lib/types/decisions';
import { decisionService } from '@/lib/decisions/decision.service';

const log = createLogger('api:decisions');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasMemberRole = await verifyRole(auth, 'member');
    if (!hasMemberRole) return forbiddenResponse('Keine Berechtigung.');
    const hasAdminRole = await verifyRole(auth, 'trainer'); // trainer/admin/superadmin

    if (!auth.clubId) return unauthorizedResponse('Club-Kontext fehlt');

    const statusParam = request.nextUrl.searchParams.get('status') as
      'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | null;

    // decisionService uses a service-role client (bypasses RLS), so plain
    // members must never be handed 'draft' decisions regardless of what
    // status they request — those aren't published/votable yet.
    const effectiveStatus = hasAdminRole
      ? (statusParam ?? undefined)
      : statusParam === 'draft'
        ? undefined // fall through to the default member-visible set below
        : statusParam;

    try {
      let decisions = await decisionService.listDecisions(auth.clubId, {
        status: effectiveStatus ?? undefined,
      });
      if (!hasAdminRole) {
        decisions = decisions.filter((d) => d.status !== 'draft');
      }
      return NextResponse.json({ decisions });
    } catch (err) {
      log.error('GET /api/decisions fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      const hasRole = await verifyRole(auth, 'admin');
      if (!hasRole) return forbiddenResponse('Admin erforderlich');
      if (!auth.clubId) return unauthorizedResponse('Club-Kontext fehlt');

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) return rateLimitError;

      const body = await request.json();
      const validation = validateRequestBody(CreateDecisionSchema, body);
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
      const input: CreateDecisionInput = validation.data;

      try {
        const decision = await decisionService.createDecision(auth.clubId, auth.user.id, input);
        return NextResponse.json({ decision }, { status: 201 });
      } catch (err) {
        log.error('POST /api/decisions fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
      }
    });
  });
}
