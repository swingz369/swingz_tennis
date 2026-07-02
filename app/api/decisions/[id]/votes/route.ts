/**
 * app/api/decisions/[id]/votes/route.ts
 * POST /api/decisions/[id]/votes   → Stimme abgeben (Upsert für idempotente Revoting)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse, unauthorizedResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { validateRequestBody, formatValidationErrors } from '@/lib/validation-schemas';
import type { ZodError } from 'zod';
import { CastVoteSchema } from '@/lib/types/decisions';
import { decisionService } from '@/lib/decisions/decision.service';

const log = createLogger('api:decisions/votes');
const sb = createServiceClient();

/** GET /api/decisions/[id]/votes → current user's own vote on this decision (or null). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Login erforderlich');

    const { id } = await params;
    const { data, error } = await sb
      .from('decision_votes')
      .select('id, decision_id, voter_id, choice, voted_at')
      .eq('decision_id', id)
      .eq('voter_id', auth.user.id)
      .maybeSingle();

    if (error) {
      log.error('vote lookup failed', { decisionId: id, error: error.message });
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
    return NextResponse.json({ vote: data ?? null });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      const hasRole = await verifyRole(auth, 'member');
      if (!hasRole) return forbiddenResponse('Login erforderlich');
      if (!auth.clubId) return unauthorizedResponse('Club-Kontext fehlt');

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
      if (rateLimitError) return rateLimitError;

      const { id } = await params;
      const body = await request.json();
      const validation = validateRequestBody(CastVoteSchema, body);
      if (!validation.success) {
        const errors = (validation as { success: false; errors: ZodError }).errors;
        return NextResponse.json(
          { error: 'Ungültige Stimme', details: formatValidationErrors(errors) },
          { status: 400 }
        );
      }

      // Validiere Decision-Zugehörigkeit zum Club des Voters
      const { data: decision } = await sb
        .from('board_decisions')
        .select('club_id, status')
        .eq('id', id)
        .single();
      if (!decision?.club_id) {
        return NextResponse.json({ error: 'Beschluss nicht gefunden' }, { status: 404 });
      }
      // Member muss in demselben Club sein
      if (decision.club_id !== auth.clubId) {
        return forbiddenResponse('Fremder Verein.');
      }
      // Abstimmung nur bei 'in_progress' oder 'scheduled'
      if (decision.status !== 'in_progress' && decision.status !== 'scheduled') {
        return NextResponse.json(
          { error: 'Beschluss akzeptiert keine Stimmen (Status: ' + decision.status + ').' },
          { status: 400 }
        );
      }

      try {
        await decisionService.castVote(id, auth.user.id, validation.data);
        return NextResponse.json({ success: true });
      } catch (err) {
        log.error('vote failed', {
          decisionId: id,
          voterId: auth.user.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
      }
    });
  });
}
