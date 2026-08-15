import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { SEPAMandateService } from '@/src/application/services/sepa-mandate.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import type { ZodError } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sepa-mandates');

import {
  CreateSEPAMandateSchema,
  validateRequestBody,
  formatValidationErrors,
} from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        // Admin can create mandates for any member; members can only sign their own
        const isAdmin = await verifyRole(auth, 'admin');
        const isMember = await verifyRole(auth, 'member');
        if (!isAdmin && !isMember) {
          return forbiddenResponse('Keine Berechtigung zum Anlegen von SEPA-Mandaten');
        }

        const body = await request.json();

        // Members can only create mandates for themselves
        if (!isAdmin && body.memberId && body.memberId !== auth.user.id) {
          return forbiddenResponse('Mitglieder können nur Mandate für sich selbst anlegen');
        }
        if (!isAdmin) {
          body.memberId = auth.user.id;
        }

        // Validate request body with Zod
        const validation = validateRequestBody(CreateSEPAMandateSchema, body);
        if (!validation.success) {
          const errors = (validation as { success: false; errors: ZodError }).errors;
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: formatValidationErrors(errors),
            },
            { status: 400 }
          );
        }

        // Create mandate
        const mandate = await SEPAMandateService.createMandate(
          validation.data.memberId,
          validation.data
        );

        return NextResponse.json({ success: true, mandate });
      } catch (error) {
        log.error('SEPA mandate creation error:', error);
        return internalErrorResponse();
      }
    });
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    try {
      const { searchParams } = new URL(request.url);
      const memberId = searchParams.get('memberId');
      const mandateId = searchParams.get('mandateId');
      const active = searchParams.get('active');

      // Trainer and above may look up any member's mandates. A member may read
      // exactly one thing: their own active mandate — the counterpart to POST,
      // which already lets them sign it. Without this, /profile → Zahlungen
      // answered 403 for every member.
      const isPrivileged = await verifyRole(auth, 'trainer');
      const readsOwnActiveMandate =
        active === 'true' && !mandateId && (!memberId || memberId === auth.user.id);
      if (!isPrivileged && !readsOwnActiveMandate) {
        return forbiddenResponse('Keine Berechtigung zum Anzeigen von SEPA-Mandaten');
      }

      if (mandateId) {
        const mandate = await SEPAMandateService.getMandateById(mandateId);
        if (!mandate) {
          return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
        }
        return NextResponse.json({ mandate });
      }

      // Support ?active=true — returns active mandate for the given member or the authenticated user
      if (active === 'true') {
        const targetMemberId = memberId || auth.user.id;
        const activeMandate = await SEPAMandateService.getActiveMandateForMember(targetMemberId);
        if (!activeMandate) {
          return NextResponse.json({ mandate: null, active: false });
        }
        return NextResponse.json({ mandate: activeMandate, active: true });
      }

      if (memberId) {
        const mandates = await SEPAMandateService.getAllMandatesForMember(memberId);
        return NextResponse.json({ mandates });
      }

      return NextResponse.json({ error: 'Member ID or Mandate ID is required' }, { status: 400 });
    } catch (error) {
      log.error('SEPA mandate fetch error:', error);
      return internalErrorResponse();
    }
  });
}
